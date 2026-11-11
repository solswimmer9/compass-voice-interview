// PPE trial: lets tester accounts run Oxford-style PPE interviews with Dr Vale from the draft PPE
// cards, while geography keeps its fixed prompt. Server-only.
//
// Access: only signed-in accounts in PREVIEW_TESTER_EMAILS (checked in live-relay.server.ts and
// assess.server.ts). The trial never consumes or grants interview credits. Students cannot
// start PPE until a card is approved, at which point this file should be replaced by the normal
// content-layer path (isTutorAvailable("ppe") becomes true).
import { buildSession } from "../content/build-session.ts";
import { tutorById } from "../content/index.ts";
import { selectCards } from "../content/select-cards.ts";
import type { SessionContext, TopicCard, Tutor } from "../content/types.ts";

export const PPE_TRIAL_TUTOR_ID = "ppe";

/** Shown when someone outside the tester list asks for the PPE trial. */
export const PPE_TRIAL_CLOSED =
  "The PPE tutor is still being tested and is not open yet. Try the geography interview instead.";

export function isPpeTrialRequest(tutorId: unknown): boolean {
  return tutorId === PPE_TRIAL_TUTOR_ID;
}

export function ppeTutor(): Tutor {
  const tutor = tutorById(PPE_TRIAL_TUTOR_ID);
  if (!tutor) throw new Error("The PPE tutor is missing");
  return tutor;
}

/** Builds one PPE trial interview from draft and approved cards. Pure apart from hashing. */
export async function buildPpeTrialSession(event: {
  openingTurn?: unknown;
  strand?: unknown;
}): Promise<SessionContext> {
  const tutor = ppeTutor();
  const seed = typeof event.openingTurn === "number" ? event.openingTurn : undefined;
  const base = { includeDrafts: true, ...(seed === undefined ? {} : { seed }) };
  let cards = selectCards(tutor, [], base);
  if (typeof event.strand === "string") {
    // Unknown strands fall back to every card.
    const inStrand = selectCards(tutor, [], { ...base, strand: event.strand });
    if (inStrand.length) cards = inStrand;
  }
  return buildSession({ tutor, cards, allowDrafts: true });
}

/** Subject context for PPE feedback: reasoning guide plus the deep notes of the cards used. */
export function ppeFeedbackContext(cardIds?: unknown): string {
  const tutor = ppeTutor();
  const byId = new Map(tutor.cards.map((card) => [card.id, card]));
  const used = Array.isArray(cardIds)
    ? cardIds
        .slice(0, 10)
        .map((id) => (typeof id === "string" ? byId.get(id) : undefined))
        .filter((card, i, list): card is TopicCard => !!card && list.indexOf(card) === i)
    : [];
  const cards = used.length ? used : tutor.cards;
  const lead = used.length
    ? "TOPIC NOTES FOR THIS INTERVIEW\nThe interviewer was given these themes."
    : "TOPIC NOTES\nThe interviewer drew its themes from these notes; the interview covered only some of them.";
  return [
    tutor.reasoningGuide,
    `${lead} Use them to judge the reasoning.\n\n${cards
      .map((card) => `${card.opening} [${card.id}]\n${card.deep}`)
      .join("\n\n")}`,
  ].join("\n\n");
}
