// Biology interviews with Dr Toby: one roadmap scenario per interview (src/content/scenarios),
// worked through step by step with the roadmap checker (src/lib/interview/roadmap.ts).
// Server-only.
//
// Access: students start biology like any interview (sign-in plus one interview credit, checked
// in live-relay.server.ts) and only ever get approved scenarios. Tester accounts
// (PREVIEW_TESTER_EMAILS) use no credits and also get drafts, so new scenarios can be tried first.
import { sha256Hex } from "../content/build-session.ts";
import { tutorById } from "../content/index.ts";
import { CORE_RULES, LIMITS, PEDAGOGY_VERSION, VOICE_POLICY } from "../content/core.ts";
import { scenariosFor, selectScenario, usableScenarioById } from "../content/scenarios/index.ts";
import type { Scenario, SessionContext, Tutor } from "../content/types.ts";
import { roadmapLiveSection } from "./interview/roadmap.ts";

export const BIOLOGY_TUTOR_ID = "biology";
/** Dr Toby's output voice; Dr River is "vesper" and Prof Matt "stone". */
export const BIOLOGY_VOICE = "marin";

export function isBiologyRequest(tutorId: unknown): boolean {
  return tutorId === BIOLOGY_TUTOR_ID;
}

export function biologyTutor(): Tutor {
  const tutor = tutorById(BIOLOGY_TUTOR_ID);
  if (!tutor) throw new Error("The biology tutor is missing");
  return tutor;
}

export type BiologyAccess = {
  /** Testers only. Students must never be given draft scenarios. */
  includeDrafts?: boolean;
};

/** Builds one biology interview. Throws if no usable scenario exists. Pure apart from hashing. */
export async function buildBiologySession(
  event: { openingTurn?: unknown },
  access: BiologyAccess = {},
): Promise<SessionContext & { scenario: Scenario }> {
  const tutor = biologyTutor();
  const seed = typeof event.openingTurn === "number" ? event.openingTurn : undefined;
  const scenario = selectScenario("biology", {
    includeDrafts: access.includeDrafts === true,
    ...(seed === undefined ? {} : { seed }),
  });
  if (!scenario) throw new Error("Dr Toby is not available yet.");
  const { persona } = tutor;
  const liveInstructions = [
    persona.identity,
    CORE_RULES,
    `WHAT YOU ARE LOOKING FOR\n${persona.lookingFor}`,
    persona.habits,
    roadmapLiveSection(scenario),
    `${persona.voice}\n${VOICE_POLICY}`,
  ].join("\n\n");
  const first = scenario.steps[0];
  const opening = `Start now in ${persona.language}. Briefly introduce yourself as ${persona.name}, running a practice ${persona.subject} interview, then ask this opening question in natural words and listen: ${first?.ask ?? ""}`;
  if (new TextEncoder().encode(opening).length >= LIMITS.openingBytes) {
    throw new Error("The opening instructions are too long");
  }
  return {
    liveInstructions,
    opening,
    backendContext: biologyFeedbackContext(scenario.id, access),
    promptHash: await sha256Hex(liveInstructions),
    tutorId: "biology",
    tutorVersion: tutor.version,
    pedagogyVersion: PEDAGOGY_VERSION,
    // The scenario id rides in cardIds, so the browser hands it back for feedback.
    cardIds: [scenario.id],
    scenario,
  };
}

/** Subject context for biology feedback: reasoning guide plus the scenario's roadmap. */
export function biologyFeedbackContext(cardIds: unknown, access: BiologyAccess = {}): string {
  const tutor = biologyTutor();
  const id = Array.isArray(cardIds) ? cardIds[0] : cardIds;
  const scenario = usableScenarioById(id, "biology", access) ?? scenariosFor("biology", access)[0];
  if (!scenario) return tutor.reasoningGuide;
  return [
    tutor.reasoningGuide,
    `THE INTERVIEW'S ROADMAP\nThe interviewer worked through these questions in order, giving at most 3 hints before giving the answer, so the candidate may not have reached them all. Credit reasoning reached with a hint, and say which steps needed the answer given.\n${scenario.steps
      .map(
        (step, i) =>
          `${i + 1}. ${step.ask}\nA full answer: ${step.points.map((p) => p.text).join("; ")}.`,
      )
      .join("\n")}`,
    `SUBJECT NOTES\n${scenario.knowledge}`,
  ].join("\n\n");
}
