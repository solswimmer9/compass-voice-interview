// Restructured from the question line and notes bullet for: What does a map of countries hide? in src/lib/interview-briefing.ts.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "map-hides",
  tutor: "geography",
  strand: "human",
  tags: ["maps", "countries", "statistics", "boundaries"],
  status: "approved",
  opening: "What does a map of countries hide?",
  live: "Hook: a world map shaded by one statistic, such as a map of the most corrupt countries, or a single national average. The tension: a map makes countries look more uniform than they are. Push on: what differences within countries does it hide? Why were these boundaries chosen? Who made the map, and why?",
  deep: 'Underlying argument (Agnew, the territorial trap): maps make countries look more uniform than they are. Hooks: a "most corrupt countries" map and a single national average. Use a world map shaded by one statistic.\n\nPush on: differences within countries, the choice of boundaries, and who made the map and why.\n\nWeak moves to watch: treating a country or community as one uniform thing; assuming a problem must be solved at the same scale as its cause; retreating to a memorised case study when challenged.',
  related: ["border-line-or-process", "statistic-limits"],
  sources: [
    {
      title: "Dr River question line: What does a map of countries hide?",
      kind: "question",
    },
    {
      title: "The territorial trap (1994)",
      kind: "paper",
      authors: ["John Agnew"],
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-10",
};

export default card;
