// Approved by Solomon Allen on 2026-11-11. From Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "housing-water-pollution",
  tutor: "ppe",
  strand: "economics",
  tags: ["housing", "pollution", "regulation", "policy-design"],
  status: "approved",
  opening:
    "Is restricting new homes a fair way to reduce river pollution if other activities cause most of it?",
  live: "Hook: in parts of England, rules to protect rivers from nutrient pollution have held up new housing, even though farming and old sewage systems may cause much of the pollution. The tension: new homes add a little pollution and are easy to regulate; the bigger sources are harder to tackle. Push on: should costs follow responsibility for pollution, ability to pay, or ease of regulation? One study found modest pollution gains alongside fewer homes and higher prices, with building moving next door. What comparison would show whether schemes that offset pollution elsewhere really improve water quality?",
  deep: 'From Jan David Bakker and Niclas Moneke, "Combatting nutrient pollution through the housing market", working paper, 2026 (revise and resubmit at the Journal of Urban Economics; not an accepted article). In our own words: studying England\'s Nutrient Neutrality policy, which regulates new housing to protect water quality, they find modest pollution improvements alongside fewer completions, higher prices and construction shifting to neighbouring areas. Areas with offset schemes show better environmental outcomes and smaller housing losses; areas without them fare worse. Local administrative capacity and policy design are crucial to reconciling environmental protection and housing supply.\n\nA strong student separates fairness (who should bear the cost: polluter, payer, or the easiest target) from effectiveness (does it reduce pollution?) and side effects (higher prices, displacement). Regulating the easy target is administratively convenient but may be unfair and inefficient.\n\nEvidence for offsets: compare similar catchments with and without schemes, before and after, measuring water quality, not just permits issued.\n\nWeak moves: assuming any environmental rule is good, or any rule blocking homes is bad; ignoring displacement; asserting cause from a before-and-after alone. The pack pairs this with the infrastructure-veto card. The student is not expected to know the paper.',
  related: ["infrastructure-veto", "lower-house-prices", "rent-cap-day-after"],
  sources: [
    {
      title: "Combatting nutrient pollution through the housing market (working paper, 2026)",
      url: "https://niclasmoneke.com/wp-content/uploads/Bakker_Moneke-Combatting_Nutrient_Pollution-2026.pdf",
      kind: "paper",
      authors: ["Jan David Bakker", "Niclas Moneke"],
    },
    {
      title: "Solomon's PPE interview pack (11 November 2026): original practice questions",
      kind: "notes",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-11",
  recheckBy: "2027-11-11",
};

export default card;
