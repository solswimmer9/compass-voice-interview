// Types for the tutor content layer. See docs/context-layer-spec.md.
// Server-only: everything under src/content is imported from *.server.ts files, never browser code.

export type TutorId = "geography" | "ppe";

export type SourceKind = "paper" | "book" | "podcast" | "video" | "notes" | "question" | "data";

export type Source = {
  title: string;
  url?: string;
  kind: SourceKind;
  /**
   * Names of the people behind the source (academics, authors, speakers).
   * Not in the spec's inline type; added so the lint test can check that no author
   * is named in a card's `live` text. Leave out for our own notes and question lines.
   */
  authors?: string[];
};

export type TopicCard = {
  /** Stable slug, stored against interviews. Never rename an approved card's id. */
  id: string;
  tutor: TutorId;
  /** geography: "human" | "physical"; ppe: "philosophy" | "politics" | "economics". */
  strand: string;
  tags: string[];
  /** Only approved cards are ever selected. */
  status: "draft" | "approved";
  /** The question as asked aloud. Must fit the 480-byte opening limit once wrapped. */
  opening: string;
  /** Max 200 words. Hook, the core tension, 3-4 push-on lines. No academic names. Goes to the voice model. */
  live: string;
  /** Max 500 words. Argument, counter-positions, weak moves. May name academics. Backend and feedback only. */
  deep: string;
  /** Card ids that follow naturally. Each must exist. */
  related: string[];
  sources: Source[];
  reviewedBy: string;
  /** ISO date, YYYY-MM-DD. */
  reviewedAt: string;
  /** Set for cards based on recent research; 12 months after review. ISO date. */
  recheckBy?: string;
};

export type TutorPersona = {
  /** Spoken name, e.g. "Dr River". Always fictional, never a real academic. */
  name: string;
  /** Subject as said aloud in the opening: "a practice {subject} interview". */
  subject: string;
  /** e.g. "British English". */
  language: string;
  /** Opening paragraph of the live prompt: who the tutor is, that they are fictional. */
  identity: string;
  /** What this subject looks for in a candidate. Live. */
  lookingFor: string;
  /** Subject habits and signature moves layered on the shared core. Live. */
  habits: string;
  /** One "Voice: ..." line for the voice model. */
  voice: string;
};

export type ReadingListEntry = { author: string; title: string; year?: number };

/** A subject pack: everything one tutor knows. Adding a tutor = one folder + one registry line. */
export type Tutor = {
  id: TutorId;
  /** Semver. Bump on any change to persona, rules or cards. */
  version: string;
  /** PEDAGOGY_VERSION of core.ts this pack was written against. */
  pedagogyVersion: string;
  persona: TutorPersona;
  strands: readonly string[];
  /** The knowledge line: what a student may be assumed to know. */
  assumedKnowledge: string[];
  /** Backend and feedback models only. */
  reasoningGuide: string;
  /** The only works the tutor or feedback may ever recommend. Backend only. */
  readingList: ReadingListEntry[];
  cards: TopicCard[];
};

/**
 * An object interview: the tutor "puts something on the table" (an unlabelled chart, map or
 * image) and asks the student what it could be. Only `svg` and `alt` ever reach the browser;
 * everything in `notes` is tutor-only. Only approved objects are shown to students; drafts are
 * for tester accounts only. One file per object under objects/; see objects/index.ts.
 */
export type InterviewObject = {
  /**
   * Stable slug, sent to the browser and stored with feedback requests, so it must not hint at
   * the answer (e.g. "geo-chart-a"). Never rename an approved object's id.
   */
  id: string;
  tutor: TutorId;
  status: "draft" | "approved";
  /** Internal name. Never sent to the browser: it gives the answer away. */
  title: string;
  /** Inline SVG the student sees. No title, no series labels: nothing that says what it shows. */
  svg: string;
  /** Neutral description for screen readers, sent to the browser. Must not give the answer. */
  alt: string;
  /** Tutor-only. Goes to the voice model and feedback, never to the browser. */
  notes: {
    /** What the object actually shows, with the figures. */
    shows: string;
    /** The question as asked aloud once the object is on the table. */
    opening: string;
    /** 3-5 follow-up probes. */
    probes: string[];
    /** What good reasoning looks like here. */
    goodReasoning: string;
  };
  sources: Source[];
  reviewedBy: string;
  /** ISO date, YYYY-MM-DD. Empty for drafts. */
  reviewedAt: string;
};

export type CardDone = { id: string; at: string };

/** One per student per tutor, rewritten after each interview. */
export type StudentMemory = {
  interviews: number;
  cardsDone: CardDone[];
  /** Max 3, each under 20 words. */
  strengths: string[];
  /** Recurring weaknesses. Max 3, each under 20 words. */
  habits: string[];
  /** One sentence. */
  nextFocus: string;
};

/** What buildSession returns, plus what a run manifest needs to record. */
export type SessionContext = {
  liveInstructions: string;
  /** Under 480 bytes. Sent as the greeting instruction. */
  opening: string;
  backendContext: string;
  /** SHA-256 hex of liveInstructions. */
  promptHash: string;
  tutorId: TutorId;
  tutorVersion: string;
  pedagogyVersion: string;
  cardIds: string[];
  readingId?: string;
};
