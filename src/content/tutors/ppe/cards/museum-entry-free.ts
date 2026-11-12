// DRAFT. Written by Claude for Solomon's review; own words, no outside sources used.
// Fleshed out for review on 2026-11-12. Still a draft: students never hear it until it is approved.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "museum-entry-free",
  tutor: "ppe",
  strand: "economics",
  tags: ["public-goods", "pricing", "marginal-cost", "fairness"],
  status: "draft",
  opening: "Should museums be free to enter?",
  live: "Hook: many national museums in Britain are free to enter, while plenty of other museums charge. The tension: if entry is free, everyone pays through taxes, including people who never visit. Push on: what does one extra visitor actually cost the museum, compared with the cost of running it? Who do you think visits free museums most, and does that matter to the argument? If a museum starts charging, who stops coming? Ask the student to separate what is efficient from what is fair, and say which one they are answering.",
  deep: 'A card on average versus marginal cost and on who pays. The average cost per visitor (total running cost divided by visitors) can be high, but the marginal cost of one extra visitor when the museum is not crowded is close to zero. That is the efficiency case for free entry: charging turns away people who would gain something at almost no cost to anyone. Once crowded, the marginal cost rises, and timed tickets or charges start to make sense.\n\nSimple numbers if the student needs them, said aloud as made-up numbers: a museum costs £10 million a year to run and has a million visitors, so the average cost is £10 a visit; an extra visitor on a quiet Tuesday costs almost nothing. Ask which number should set the price.\n\nThe fairness question is separate. Free entry funded by taxes means non-visitors pay; if visitors are mostly better-off or live nearby, that may be a transfer from poorer to richer or from the regions to big cities. But charging may deter exactly the visitors the museum most wants to reach. A strong student holds both and reaches a position, perhaps a targeted design (free for some, a charge for exhibitions, a charge for overseas visitors) and says what it gives up.\n\nThe "who visits" push-on asks for the student\'s guess and then how they would find out; they are not expected to know any figures.\n\nWeak moves: "culture should be free" as if a value settled the funding question; treating "cost" as one number; ignoring who actually visits.\n\nGood push-ons: should swimming pools or buses be free by the same logic; what evidence would show whether free entry widened access.',
  related: ["bag-charge", "ticket-prices-fair", "fairness-three-principles"],
  sources: [
    {
      title: "Compass practice question and notes, written by Claude (no outside source)",
      kind: "question",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default card;
