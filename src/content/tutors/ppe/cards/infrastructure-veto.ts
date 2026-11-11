// DRAFT from Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "infrastructure-veto",
  tutor: "ppe",
  strand: "politics",
  tags: ["infrastructure", "local-consent", "housing", "data-centres"],
  status: "draft",
  opening: "Should communities be able to veto infrastructure whose benefits are national?",
  live: "Hook: a data centre or a housing estate may help the whole country while one village bears the noise, traffic or lost fields. The tension: the gains are spread thinly over many people, the costs land heavily on a few. Push on: separate the size of the total benefit from who bears the local cost. Would paying compensation make a veto unnecessary, or would it make consent less meaningful? Should local residents be able to block housing for people who do not live there yet? Whose interests count, and through what decision procedure?",
  deep: 'Combines the pack\'s note on Political Currency episode 338 (public acceptance of data centres) and the Williams pack question MWQ20 on local residents blocking housing. The pack\'s infrastructure theme: data centres are a strong case for national gains and local burdens, connecting to housing debates about who decides, who pays, who benefits, and whether compensation changes the moral claim to refuse development. The pack pairs it with Niclas Moneke\'s paper on nutrient neutrality and housing supply (see the housing-water-pollution card).\n\nA strong student identifies the structure: concentrated costs and diffuse benefits create strong incentives for local opposition, so a local veto can block projects that would be worth it overall. But local people have special claims: they live there and the costs to them are real.\n\nCompensation: if harm can be fully compensated, a veto looks like a hold-out; but if some losses are not tradeable, paying people may feel like buying consent. Future residents of new housing are absent from local decisions, an important point about whose interests count.\n\nWeak moves: treating either "democracy" or "growth" as settling it; forgetting future residents; ignoring incentives to overstate local costs.',
  related: ["housing-water-pollution", "lower-house-prices", "what-is-a-problem"],
  sources: [
    {
      title:
        "Political Currency, episode 338: Regrets, leaks and data centres (publisher description)",
      url: "https://shows.acast.com/politicalcurrency-1/episodes/emqs-regrets-leaks-and-data-centres",
      kind: "podcast",
      authors: ["George Osborne", "Ed Balls"],
    },
    {
      title: "What? Why? When? (Jesus College Oxford): What's the Problem? (publisher description)",
      url: "https://shows.acast.com/what-why-when/episodes/69b9644505ad897c0293c30b",
      kind: "podcast",
      authors: ["Matt Williams"],
    },
    {
      title: "Solomon's PPE interview pack (11 November 2026): original practice questions",
      kind: "notes",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default card;
