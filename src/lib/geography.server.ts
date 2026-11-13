// Dr River on topic cards: a geography interview built from the content layer. Server-only.
//
// Access: only signed-in tester accounts (PREVIEW_TESTER_EMAILS, checked by live-relay.server.ts
// with testers.ts) get this prompt, so it can be voice-tested. Every other student keeps the fixed
// Dr River prompt from interview-briefing.ts. Unlike PPE, testers never hear geography drafts:
// only approved cards are ever used, for anyone.
import { buildSession } from "../content/build-session.ts";
import { tutorById } from "../content/index.ts";
import { selectCards, type SelectCardsOptions } from "../content/select-cards.ts";
import type { SessionContext, Tutor } from "../content/types.ts";
import { readingById } from "./readings.ts";

export const GEOGRAPHY_TUTOR_ID = "geography";
/** How the backend model names the interviewer; matches the fixed prompt's wording. */
export const GEOGRAPHY_SUBJECT = "Cambridge geography";

export function geographyTutor(): Tutor {
  const tutor = tutorById(GEOGRAPHY_TUTOR_ID);
  if (!tutor) throw new Error("The geography tutor is missing");
  return tutor;
}

/**
 * Builds one card-based geography interview. Approved cards only; drafts are never selected and
 * buildSession refuses them. A practice reading (readingId) opens the interview, with cards after
 * it, as in commit c109dfc. Throws if no session can be built. Pure apart from hashing.
 */
export async function buildGeographySession(event: {
  openingTurn?: unknown;
  strand?: unknown;
  readingId?: unknown;
}): Promise<SessionContext> {
  const tutor = geographyTutor();
  const reading = readingById(event.readingId) ?? null;
  const options: SelectCardsOptions = { includeDrafts: false };
  if (typeof event.openingTurn === "number") options.seed = event.openingTurn;
  // No stored card history or memory yet: pass them here once they are saved.
  let cards = selectCards(tutor, [], options);
  if (typeof event.strand === "string") {
    // An unknown strand, or one with no approved cards, falls back to every approved card.
    const inStrand = selectCards(tutor, [], { ...options, strand: event.strand });
    if (inStrand.length) cards = inStrand;
  }
  // Belt and braces: never pass a draft on, whatever selectCards returns.
  cards = cards.filter((card) => card.status === "approved" && card.tutor === tutor.id);
  if (!cards.length && !reading) throw new Error("Dr River's topic cards are not available yet.");
  return buildSession({ tutor, cards, reading, allowDrafts: false });
}
