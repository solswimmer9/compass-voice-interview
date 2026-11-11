// Subject context for the feedback model and the live backend's system line. Pure; server-only.
import { approvedReadingList } from "./build-session.ts";
import { cardsFor } from "./index.ts";
import type { TopicCard, Tutor } from "./types.ts";

/** Most card ids accepted from a request; an interview uses at most 3. */
const MAX_CARD_IDS = 10;

/**
 * How the interviewer is described to backend models, e.g. "a spoken {subject} admissions
 * interviewer". Geography keeps today's "Cambridge geography" wording.
 */
export function interviewerSubject(tutor: Tutor): string {
  return tutor.id === "geography" ? "Cambridge geography" : tutor.persona.subject;
}

/** The tutor's approved cards named in cardIds, in the given order. Anything else is ignored. */
export function feedbackCards(tutor: Tutor, cardIds: unknown): TopicCard[] {
  if (!Array.isArray(cardIds)) return [];
  const approved = new Map(cardsFor(tutor.id).map((card) => [card.id, card]));
  const chosen: TopicCard[] = [];
  for (const id of cardIds.slice(0, MAX_CARD_IDS)) {
    const card = typeof id === "string" ? approved.get(id) : undefined;
    if (card && !chosen.includes(card)) chosen.push(card);
  }
  return chosen;
}

/**
 * Subject context for the feedback prompt: the tutor's reasoning guide, the deep notes of the
 * interview's cards (or, when none are known, of every approved card), and the approved reading list.
 */
export function buildFeedbackContext(tutor: Tutor, cardIds?: unknown): string {
  const used = feedbackCards(tutor, cardIds);
  const cards = used.length ? used : cardsFor(tutor.id);
  const lead = used.length
    ? "TOPIC NOTES FOR THIS INTERVIEW\nThe interviewer was given these themes."
    : "TOPIC NOTES\nThe interviewer drew its themes from these notes; the interview covered only some of them.";
  return [
    tutor.reasoningGuide,
    cards.length
      ? `${lead} Use them to judge the reasoning; never expect the candidate to know the academics named.\n\n${cards
          .map((card) => `${card.opening} [${card.id}]\n${card.deep}`)
          .join("\n\n")}`
      : "",
    approvedReadingList(tutor),
  ]
    .filter(Boolean)
    .join("\n\n");
}
