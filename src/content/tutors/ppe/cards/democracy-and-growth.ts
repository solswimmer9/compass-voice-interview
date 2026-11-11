// Approved by Solomon Allen on 2026-11-11. From Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "democracy-and-growth",
  tutor: "ppe",
  strand: "economics",
  tags: ["democracy", "growth", "causation", "measurement"],
  status: "approved",
  opening: "Does democracy cause economic growth?",
  live: "Hook: rich countries tend to be democracies, but that does not tell us which way the arrow points. The tension: democracy might create growth, prosperity might create democracy, or something else might cause both. Push on: ask the student to define democracy and growth before comparing countries. How could we test whether democracy raises growth, and what would count as a credible comparison? If democracy raised GDP but worsened inequality, would it be economically successful? Is a peaceful transfer of power enough to make a system democratic?",
  deep: "From the What? Why? When? episode Does Democracy Cause Growth? (with Economics and PPE students), whose description highlights measurement, voting and transfers of power; and pack questions MWQ07, MWQ13 and MWQ14. The pack's exercise: build two causal stories (democracy creates growth; prosperity makes democracy more likely) then identify a possible common cause.\n\nA strong student distinguishes association from causal mechanism. Possible mechanisms for democracy causing growth: secure property rights, accountability that punishes waste, investment in education. Reverse: richer, more educated populations demand democracy. Common causes: institutions, history, geography.\n\nTesting: compare countries before and after transitions to democracy with similar countries that did not change; the student should see the problem of choosing a comparison group and why transitions are not random.\n\nDefinitions matter: is democracy elections, rights, or peaceful transfers? Is growth GDP or wellbeing? The GDP-versus-inequality push-on asks what economic success means.\n\nWeak moves: citing rich democracies as proof; one-directional stories; not defining terms.",
  related: ["testing-election-causes", "resisting-education", "climate-collective-action"],
  sources: [
    {
      title:
        "What? Why? When? (Jesus College Oxford): Does Democracy Cause Growth? (publisher description)",
      url: "https://shows.acast.com/what-why-when/episodes/680b6f0ad6473fbdddb5a02e",
      kind: "podcast",
      authors: ["Matt Williams"],
    },
    {
      title: "Solomon's PPE interview pack (11 November 2026): original practice questions",
      kind: "notes",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-11",
};

export default card;
