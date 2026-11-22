// The subjects students can practise, in the order they are offered. Browser-safe: names and
// blurbs only, no prompts. To add a subject (Medicine next), add an entry here once its tutor
// is live on the server; its readings, if any, go in src/lib/readings.ts with that subject id.

export type SubjectId = "ppe" | "geography" | "biology";

export type Subject = {
  id: SubjectId;
  /** e.g. "Geography" */
  name: string;
  tutor: string;
  /** The tutor's initials, for the letter's seal. */
  initials: string;
  /** One line under the tutor's name on the subject page. */
  line: string;
};

export const SUBJECTS: readonly Subject[] = [
  {
    id: "ppe",
    name: "PPE",
    tutor: "Prof Matt",
    initials: "PM",
    line: "Oxford-style Philosophy, Politics and Economics. He will test your premises.",
  },
  {
    id: "geography",
    name: "Geography",
    tutor: "Dr River",
    initials: "DR",
    line: "Built from real Cambridge geography notes. He will ask why, then ask again.",
  },
  {
    id: "biology",
    name: "Biology",
    tutor: "Dr Toby",
    initials: "DT",
    line: "Cambridge-style Natural Sciences, and good practice for medicine. He takes you through a real problem step by step, with hints when you are stuck.",
  },
];

export function subjectById(id: unknown): Subject | undefined {
  return SUBJECTS.find((subject) => subject.id === id);
}

/** A known subject, or geography (Dr River) for anything else, as links without a tutor mean. */
export function subjectOrGeography(id: unknown): Subject {
  return subjectById(id) ?? (subjectById("geography") as Subject);
}
