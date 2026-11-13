// The subjects students can practise, in the order they are offered. Browser-safe: names and
// blurbs only, no prompts. To add a subject (Medicine next), add an entry here once its tutor
// is live on the server; its readings, if any, go in src/lib/readings.ts with that subject id.

export type SubjectId = "ppe" | "geography";

export type Subject = {
  id: SubjectId;
  /** e.g. "Geography" */
  name: string;
  tutor: string;
  /** One line under the tutor's name on the subject page. */
  line: string;
};

export const SUBJECTS: readonly Subject[] = [
  {
    id: "ppe",
    name: "PPE",
    tutor: "Prof Matt",
    line: "Oxford-style Philosophy, Politics and Economics. He will test your premises.",
  },
  {
    id: "geography",
    name: "Geography",
    tutor: "Dr River",
    line: "Built from real Cambridge geography notes. He will ask why, then ask again.",
  },
];

export function subjectById(id: unknown): Subject | undefined {
  return SUBJECTS.find((subject) => subject.id === id);
}
