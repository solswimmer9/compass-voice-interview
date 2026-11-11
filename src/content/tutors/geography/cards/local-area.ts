// Restructured from the question line and notes bullet for: If I visited your local area, what would I find interesting? in src/lib/interview-briefing.ts.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "local-area",
  tutor: "geography",
  strand: "human",
  tags: ["local-area", "place", "comparison"],
  status: "approved",
  opening: "If I visited your local area, what would I be interested in?",
  live: "Hook: the student's own local area, seen by a visitor. The tension: what a visitor can see against what is invisible to them. Push on: what has shaped it? What is invisible to a visitor? How does it compare with somewhere else?",
  deep: "Underlying argument: start from a place the student knows. The question is what has shaped it, what is invisible to a visitor, and how it compares with somewhere else.\n\nPush on: what has shaped it, what is invisible to a visitor, and how it compares with somewhere else.\n\nWeak moves to watch: treating a country or community as one uniform thing; retreating to a memorised case study when challenged; a both-sides summary without reaching a position.",
  related: ["place-changed-thinking", "regeneration-who-for"],
  sources: [
    {
      title: "Dr River question line: If I visited your local area, what would I find interesting?",
      kind: "question",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-10",
};

export default card;
