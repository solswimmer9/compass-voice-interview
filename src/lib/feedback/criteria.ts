// Reasoning criteria the transcript analyst judges against, per subject. They restate the
// headings already used in today's feedback prompts (assess.server.ts) so the evidence-checked
// path and the plain path look for the same things.
import type { Criterion } from "./pipeline";

const SHARED: Criterion[] = [
  {
    id: "assumptions",
    name: "Examining assumptions",
    evidenceLooksLike:
      "The student names an assumption under their own claim, or asks whether it holds.",
    notEvidence: "Stating a conclusion confidently; agreeing that something is complicated.",
  },
  {
    id: "evidence",
    name: "Using evidence and examples",
    evidenceLooksLike:
      "The student supports a claim with a concrete case, observation or number, or says what evidence would decide it.",
    notEvidence: "Naming a theory, academic or case study without using it to argue.",
  },
  {
    id: "pushback",
    name: "Engaging with pushback",
    evidenceLooksLike:
      "After a challenge, the student defends a point with a reason, or changes the precise part the challenge affects.",
    notEvidence: "Simply agreeing with the tutor, or repeating the original answer.",
  },
  {
    id: "thinking-aloud",
    name: "Reasoning aloud",
    evidenceLooksLike:
      "The student works towards an answer step by step, giving a provisional answer and a reason.",
    notEvidence: "A memorised definition or a list of facts.",
  },
];

export const GEOGRAPHY_CRITERIA: Criterion[] = [
  ...SHARED,
  {
    id: "scale",
    name: "Changing scale and perspective",
    evidenceLooksLike:
      "The student moves between scales (local to global, short to long term) or asks whose view is missing and who gains or loses.",
    notEvidence:
      "Mentioning that a place is big or that people disagree, with no consequence drawn.",
  },
];

export const PPE_CRITERIA: Criterion[] = [
  ...SHARED,
  {
    id: "facts-values",
    name: "Separating facts from values",
    evidenceLooksLike:
      "The student distinguishes a factual assumption from a value judgement, or notices a value being asserted as a fact.",
    notEvidence: "Saying something is right or wrong with no reason.",
  },
  {
    id: "consequences",
    name: "Second-round effects",
    evidenceLooksLike:
      "The student follows a policy or argument past its first effect to how people respond to it.",
    notEvidence: "Listing advantages and disadvantages without linking them.",
  },
  {
    id: "terms",
    name: "Holding terms steady",
    evidenceLooksLike:
      "The student defines a key term and keeps to that meaning, or notices it shifting.",
    notEvidence: "Using a term loosely in several senses.",
  },
];

export const BIOLOGY_CRITERIA: Criterion[] = [
  ...SHARED,
  {
    id: "mechanism",
    name: "Reasoning from mechanism",
    evidenceLooksLike:
      "The student explains why in terms of what molecules or cells are doing, such as hydrogen bonds breaking or an enzyme acting.",
    notEvidence: "Reciting a definition or a list of steps with no reason given.",
  },
  {
    id: "using-hints",
    name: "Using new information",
    evidenceLooksLike:
      "After a hint or a new fact from the tutor, the student builds on it to reach the next step themselves.",
    notEvidence: "Repeating the hint back, or waiting for the tutor to supply the answer.",
  },
  {
    id: "quantitative",
    name: "Quantitative reasoning",
    evidenceLooksLike:
      "The student sets up a calculation or estimate aloud, uses a shortcut such as powers of two, or reuses an earlier result.",
    notEvidence:
      "A number with no working, or redoing a whole calculation when an earlier result applies.",
  },
];
