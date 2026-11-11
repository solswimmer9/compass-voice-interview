// PPE interviews with Prof Matt, built from the content layer while geography keeps its fixed
// prompt. Server-only.
//
// Access: students start PPE like any interview (sign-in plus one interview credit, checked in
// live-relay.server.ts) and hear approved cards only. Tester accounts (PREVIEW_TESTER_EMAILS) use
// no credits and also hear draft cards, so new cards can be tried before approval.
import { buildSession } from "../content/build-session.ts";
import { tutorById } from "../content/index.ts";
import { selectCards } from "../content/select-cards.ts";
import type { SessionContext, TopicCard, Tutor } from "../content/types.ts";

export const PPE_TUTOR_ID = "ppe";

export function isPpeRequest(tutorId: unknown): boolean {
  return tutorId === PPE_TUTOR_ID;
}

export function ppeTutor(): Tutor {
  const tutor = tutorById(PPE_TUTOR_ID);
  if (!tutor) throw new Error("The PPE tutor is missing");
  return tutor;
}

export type PpeAccess = {
  /** Testers only. Students must never be given draft cards. */
  includeDrafts?: boolean;
};

function usableCards(tutor: Tutor, access: PpeAccess): TopicCard[] {
  return tutor.cards.filter((card) => card.status === "approved" || access.includeDrafts === true);
}

/** Builds one PPE interview. Throws if no usable card exists. Pure apart from hashing. */
export async function buildPpeSession(
  event: { openingTurn?: unknown; strand?: unknown },
  access: PpeAccess = {},
): Promise<SessionContext> {
  const tutor = ppeTutor();
  const includeDrafts = access.includeDrafts === true;
  const seed = typeof event.openingTurn === "number" ? event.openingTurn : undefined;
  const base = { includeDrafts, ...(seed === undefined ? {} : { seed }) };
  let cards = selectCards(tutor, [], base);
  if (typeof event.strand === "string") {
    // Unknown strands, or strands with no usable cards, fall back to every usable card.
    const inStrand = selectCards(tutor, [], { ...base, strand: event.strand });
    if (inStrand.length) cards = inStrand;
  }
  if (!cards.length) throw new Error("The PPE tutor is not available yet.");
  return buildSession({ tutor, cards, allowDrafts: includeDrafts });
}

/** Subject context for PPE feedback: reasoning guide, deep notes of the cards used, reading list. */
export function ppeFeedbackContext(cardIds?: unknown, access: PpeAccess = {}): string {
  const tutor = ppeTutor();
  const usable = usableCards(tutor, access);
  const byId = new Map(usable.map((card) => [card.id, card]));
  const used = Array.isArray(cardIds)
    ? cardIds
        .slice(0, 10)
        .map((id) => (typeof id === "string" ? byId.get(id) : undefined))
        .filter((card, i, list): card is TopicCard => !!card && list.indexOf(card) === i)
    : [];
  const cards = used.length ? used : usable;
  const lead = used.length
    ? "TOPIC NOTES FOR THIS INTERVIEW\nThe interviewer was given these themes."
    : "TOPIC NOTES\nThe interviewer drew its themes from these notes; the interview covered only some of them.";
  return [
    tutor.reasoningGuide,
    `${lead} Use them to judge the reasoning; never expect the candidate to know the academics named.\n\n${cards
      .map((card) => `${card.opening} [${card.id}]\n${card.deep}`)
      .join("\n\n")}`,
    `APPROVED READING LIST\nOnly ever mention or recommend these, and never invent a reference.\n${tutor.readingList
      .map((entry) => `- ${entry.author}, ${entry.title}${entry.year ? ` (${entry.year})` : ""}`)
      .join("\n")}`,
  ].join("\n\n");
}
