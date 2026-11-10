export type Turn = {
  /** 1-based position in the whole transcript (tutor and student turns both count). */
  turn: number;
  role: "user" | "assistant";
  text: string;
  /** True when speech recognition was unclear for this turn. */
  unclear?: boolean;
};

export type Evidence = { turn: number; quote: string };

export type Observation = {
  id: string;
  criterionId: string;
  kind: "strength" | "improvement" | "knowledge_gap";
  claim: string;
  evidence: Evidence[];
};

export type FeedbackReport = {
  interviewId: string;
  /** Verified only. */
  observations: Observation[];
  sections: { heading: string; body: string; observationIds: string[] }[];
  nextQuestion: string;
  /** e.g. "Turns 9-11 were unclear in the transcript" */
  caveats: string[];
  manifest: unknown;
};
