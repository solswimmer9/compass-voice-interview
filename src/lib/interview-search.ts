export type InterviewSearch = { reading?: string; tutor?: "ppe" };

/** Search params for the interview room. Shared with the home page, which redirects old links. */
export function parseInterviewSearch(search: Record<string, unknown>): InterviewSearch {
  return {
    ...(typeof search["reading"] === "string" ? { reading: search["reading"] } : {}),
    // PPE with Prof Matt. Uses an interview credit like geography (none for tester accounts).
    ...(search["tutor"] === "ppe" ? { tutor: "ppe" as const } : {}),
  };
}
