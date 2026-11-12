// DRAFT from Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
// Fleshed out for review on 2026-11-12. Still a draft: students never hear it until it is approved.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "rights-outweigh-benefit",
  tutor: "ppe",
  strand: "philosophy",
  tags: ["rights", "welfare", "trade-offs"],
  status: "draft",
  opening: "Why should one person's right sometimes outweigh a larger benefit to other people?",
  live: "Hook: we would not take one person's kidney to save two others, even though more lives would be saved. The tension: if outcomes are what matter, rights look like an obstacle; if rights matter, we need to say why numbers sometimes do not. Push on: is it the difference between saving lives and merely giving people pleasure that explains our reactions, or do rights add something extra? Try a case where a small harm to one person would give great enjoyment to a huge crowd. Can welfare play a central role in morality without every right becoming tradeable?",
  deep: 'From Thomas Sinclair, "Rights, conflicts, and the mechanics of claims", Journal of Moral Philosophy, 2024. In our own words: a theory of rights must explain why some interests get special weight in deciding what is permissible while others do not. Sinclair examines Alec Walen\'s account of claims and argues that its welfare principle gives welfare interests too much priority, undermining its appeal; he considers repairs but finds deeper questions unresolved.\n\nA strong student contrasts aggregation (add up benefits and harms) with constraints (some things may not be done to a person whatever the total). Classic cases: transplant, a crowd watching a painful broadcast, a trolley. They should notice that intuitions differ between saving lives and providing minor benefits, and ask whether that is because of rights or because small benefits should not be added up against serious harms.\n\nThe final push-on tests consistency: if welfare grounds rights, enough welfare might seem to override them; a good answer explains which interests are protected and why.\n\nWeak moves: "rights just exist"; counting only numbers; treating all trade-offs as alike. The student is not expected to know the paper.',
  related: ["organ-allocation", "prepunishment", "offensive-speech"],
  sources: [
    {
      title: "Rights, conflicts, and the mechanics of claims (2024)",
      url: "https://doi.org/10.1163/17455243-20234343",
      kind: "paper",
      authors: ["Thomas Sinclair", "Alec Walen"],
    },
    {
      title: "Solomon's PPE interview pack (11 November 2026): original practice questions",
      kind: "notes",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
  recheckBy: "2027-11-12",
};

export default card;
