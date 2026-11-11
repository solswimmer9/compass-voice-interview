// Assembles one interview's prompts from a tutor, its selected cards, the student's memory and an
// optional practice reading. Pure apart from hashing; server-only.
import type { Reading } from "../lib/readings.ts";
import { CORE_RULES, LIMITS, PEDAGOGY_VERSION, VOICE_POLICY } from "./core.ts";
import { renderMemory, renderMemoryFull } from "./memory.ts";
import type { ReadingListEntry, SessionContext, StudentMemory, TopicCard, Tutor } from "./types.ts";

export type SessionReading = Pick<
  Reading,
  "id" | "title" | "source" | "context" | "questions" | "tutorThoughts"
>;

export type BuildSessionInput = {
  tutor: Tutor;
  /** From selectCards. cards[0] is the opening card. May be empty only for a reading interview. */
  cards: readonly TopicCard[];
  memory?: StudentMemory | null;
  reading?: SessionReading | null;
  /** Accept draft cards. Only for tester-only experiments such as the PPE trial. */
  allowDrafts?: boolean;
};

/** Today's openingInstructions() form, for any tutor. */
export function cardOpening(tutor: Tutor, card: TopicCard): string {
  const { language, name, subject } = tutor.persona;
  return `Start now in ${language}. Briefly introduce yourself as ${name}, running a practice ${subject} interview, then ask this opening question in natural words and listen: ${card.opening}`;
}

/** Today's readingOpeningInstructions() form, for any tutor. */
export function readingOpening(tutor: Tutor, reading: Pick<Reading, "title" | "source">): string {
  const { language, name } = tutor.persona;
  return `Start now in ${language}. Briefly introduce yourself as ${name}. The student has just read "${reading.title}" (${reading.source}). Ask them to sum up its main argument in their own words, then listen.`;
}

function themesSection(cards: readonly TopicCard[], afterReading: boolean) {
  if (!cards.length) return "";
  const lead = afterReading
    ? "After the reading, turn to these themes."
    : "You open with the first theme.";
  return `YOUR THEMES FOR THIS INTERVIEW
${lead} They are the centre of the interview: draw your follow-ups and pushback from them, and explore at least one in depth. Do not read them as a list. Recognise when the student reaches one of these ideas in their own words, and push them further along it. Use general knowledge only to fill gaps.

${cards.map((card, i) => `${i + 1}. ${card.opening}\n${card.live}`).join("\n\n")}`;
}

function readingSection(reading: SessionReading) {
  return `PRACTICE READING
This interview opens on a reading the student has just read: "${reading.title}" (${reading.source}). Spend the first 10 to 15 minutes on it, as some colleges do: check they understood it, then test its argument. Do not claim to have read the full article; work from what the student says and this summary.
Summary: ${reading.context}
Questions you might ask: ${reading.questions.join(" ")}
Your own thoughts, to raise one at a time as challenges rather than lectures: ${reading.tutorThoughts.join(" ")}`;
}

function readingListLine(entry: ReadingListEntry) {
  return `- ${entry.author}, ${entry.title}${entry.year ? ` (${entry.year})` : ""}`;
}

async function sha256Hex(text: string): Promise<string> {
  // Web Crypto: global in Cloudflare Workers, Node 20+ and browsers.
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildSession({
  tutor,
  cards,
  memory = null,
  reading = null,
  allowDrafts = false,
}: BuildSessionInput): Promise<SessionContext> {
  for (const card of cards) {
    if (card.tutor !== tutor.id) throw new Error(`Card ${card.id} belongs to another tutor`);
    if (card.status !== "approved" && !allowDrafts)
      throw new Error(`Card ${card.id} is not approved`);
  }
  const first = cards[0];
  if (!first && !reading) throw new Error("An interview needs a card or a reading");

  const memoryLive = renderMemory(memory);
  const liveInstructions = [
    tutor.persona.identity,
    CORE_RULES,
    `WHAT YOU ARE LOOKING FOR\n${tutor.persona.lookingFor}`,
    tutor.persona.habits,
    reading ? readingSection(reading) : "",
    themesSection(cards, !!reading),
    memoryLive ? `ABOUT THIS STUDENT\n${memoryLive}` : "",
    `${tutor.persona.voice}\n${VOICE_POLICY}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const opening = reading ? readingOpening(tutor, reading) : cardOpening(tutor, first as TopicCard);
  if (new TextEncoder().encode(opening).length >= LIMITS.openingBytes) {
    throw new Error("The opening instructions are too long");
  }

  const backendContext = [
    tutor.reasoningGuide,
    cards.length
      ? `TOPIC NOTES FOR THIS INTERVIEW\nThe interviewer was given these themes. Use them to judge and challenge the reasoning; never expect the candidate to know the academics named.\n\n${cards
          .map((card) => `${card.opening} [${card.id}]\n${card.deep}`)
          .join("\n\n")}`
      : "",
    reading
      ? `PRACTICE READING\n"${reading.title}" (${reading.source}): ${reading.context}\nQuestions: ${reading.questions.join(" ")}\nTutor's own angles: ${reading.tutorThoughts.join(" ")}`
      : "",
    `STUDENT HISTORY\n${renderMemoryFull(memory)}`,
    `APPROVED READING LIST\nOnly ever mention or recommend these, and only in feedback or when the student asks what to read. Never invent a reference.\n${tutor.readingList.map(readingListLine).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const session: SessionContext = {
    liveInstructions,
    opening,
    backendContext,
    promptHash: await sha256Hex(liveInstructions),
    tutorId: tutor.id,
    tutorVersion: tutor.version,
    pedagogyVersion: PEDAGOGY_VERSION,
    cardIds: cards.map((card) => card.id),
  };
  if (reading) session.readingId = reading.id;
  return session;
}
