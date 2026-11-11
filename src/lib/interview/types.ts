// Types for the interview director, turn analyst, run manifest and student context.
// Shapes follow docs/multi-subject-interview-architecture.md sections 6, 7 and 11.
// Pure types and zod schemas: no model calls, no I/O.
import { z } from "zod";

export const PHASES = [
  "opening",
  "comprehension",
  "baseline",
  "probing",
  "challenge",
  "synthesis",
  "closure",
] as const;
export type Phase = (typeof PHASES)[number];

export const MOVES = [
  "clarify",
  "probe_assumption",
  "request_evidence",
  "counterexample",
  "rival_interpretation",
  "change_condition",
  "steelman",
  "scaffold",
  "consolidate",
  "reflect",
] as const;
export type Move = (typeof MOVES)[number];

export const HANDLED_CHALLENGE = ["revised", "defended", "conceded", "repeated", "na"] as const;
export type HandledChallenge = (typeof HANDLED_CHALLENGE)[number];

export type Difficulty = 1 | 2 | 3 | 4;

export type TutorFlag = "leading" | "lectured" | "offTopic" | "ignoredStudent";

export type TurnState = {
  turn: number;
  phase: Phase;
  cardId: string;
  /** A Criterion id. */
  skillTested: string;
  tutorMove: Move | "other";
  studentEvidence: {
    gaveReason: boolean;
    usedExample: boolean;
    handledChallenge: HandledChallenge;
    /** A fact they lacked, not a judgement. */
    knowledgeGap: string | null;
    /** Id from the pack. */
    weakPattern: string | null;
  };
  tutorFlags: { leading: boolean; lectured: boolean; offTopic: boolean; ignoredStudent: boolean };
  transcriptUnclear: boolean;
  difficulty: Difficulty;
  /** Max 25 words. */
  nextObjective: string;
};

function capWords(max: number) {
  return (text: string) => text.split(/\s+/u).filter(Boolean).slice(0, max).join(" ");
}

const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** Validates a model's JSON for one turn. Over-long free text is cut, not rejected. */
export const TurnStateSchema = z.object({
  turn: z.number().int().min(0),
  phase: z.enum(PHASES),
  cardId: z.string().max(120),
  skillTested: z.string().max(120),
  tutorMove: z.union([z.enum(MOVES), z.literal("other")]),
  studentEvidence: z.object({
    gaveReason: z.boolean(),
    usedExample: z.boolean(),
    handledChallenge: z.enum(HANDLED_CHALLENGE),
    knowledgeGap: z.string().max(300).nullable(),
    weakPattern: z.string().max(120).nullable(),
  }),
  tutorFlags: z.object({
    leading: z.boolean(),
    lectured: z.boolean(),
    offTopic: z.boolean(),
    ignoredStudent: z.boolean(),
  }),
  transcriptUnclear: z.boolean(),
  difficulty: DifficultySchema,
  nextObjective: z.string().max(600).transform(capWords(25)),
});

// Compile-time check that the schema and the documented type agree.
type SchemaOutput = z.infer<typeof TurnStateSchema>;
const _schemaMatchesType: (a: SchemaOutput) => TurnState = (a) => a;
void _schemaMatchesType;

/**
 * What the director asks the live tutor to do next. `reason` and `text` are as documented.
 * `expect` is added so compliance can be checked later; the text is generated from it.
 */
export type SteeringNote = {
  reason: "phase" | "difficulty" | "correction" | "care";
  /** Max 60 words and under 480 bytes. */
  text: string;
  expect?: {
    phase?: Phase;
    difficulty?: Difficulty;
    move?: Move;
    avoidFlags?: TutorFlag[];
    avoidMoves?: Move[];
    care?: "slow" | "close";
  };
};

export type RunManifest = {
  interviewId: string;
  pedagogyVersion: string;
  pack: { id: string; version: string };
  cardIds: string[];
  /** SHA-256 of the assembled opening prompt. */
  promptHash: string;
  models: { live: string; analyst: string; feedback: string; video?: string };
  /** Whatever model identifiers the gateway returns. */
  gatewayReported?: Record<string, string>;
  directorVersion: string;
  feedbackPipelineVersion: string;
  createdAt: string;
  /** Added: the reading or stimulus used, when there was one. */
  stimulusId?: string;
};

export type StudentObservationKind = "demonstrated" | "to_develop" | "misconception";

export type StudentObservation = {
  criterionId: string;
  kind: StudentObservationKind;
  /** Max 20 words, about the reasoning, never the person. */
  note: string;
  evidence: { interviewId: string; turn: number; quote: string }[];
  lastSeen: string;
};

export type StudentContext = {
  subjectId: string;
  interviews: number;
  cardsDone: { id: string; at: string }[];
  observations: StudentObservation[];
  /** Level held in the last interview. */
  sustainedDifficulty: Difficulty;
};

/** Pack-supplied inputs for the turn analyst (architecture document, section 5). */
export type Criterion = {
  id: string;
  name: string;
  evidenceLooksLike: string;
  notEvidence: string;
};
export type WeakPattern = { id: string; description: string };
