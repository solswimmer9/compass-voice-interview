// DRAFT. Written by Claude for Solomon's review; own words, no outside sources used.
// Fleshed out for review on 2026-11-12. Still a draft: students never hear it until it is approved.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "ticket-prices-fair",
  tutor: "ppe",
  strand: "economics",
  tags: ["markets", "fairness", "allocation"],
  status: "draft",
  opening: "Is it unfair to sell concert tickets to whoever will pay the most?",
  live: 'Hook: imagine a band sells tickets at a low fixed price, they sell out in minutes, and resellers sell them on for five times as much. The tension: the band chose a low price to be fair to fans, but the tickets went to whoever paid most anyway. Push on: what does "fair" mean here: equal chances, rewarding the biggest fans, or letting people pay what it is worth to them? Is a queue or a lottery fairer than a price, and fairer for whom? Who gets the extra money in each version? Ask the student to defend their fairest method against its best objection.',
  deep: 'A fairness-and-allocation card. When demand exceeds supply at the set price, something must ration: price, queueing time, luck or connections. Each has winners and losers. Price favours those with more money or who value it more; queues favour those with free time; lotteries give equal chances but ignore how much people care. The low face price does not stop high prices; it moves the extra money from the band to resellers.\n\nA strong student separates the efficiency question (who values the ticket most) from the fairness question (whether willingness to pay reflects how much someone values it or just how rich they are), and notices that "fair" is doing different jobs in different arguments.\n\nSimple numbers if useful: 1,000 seats, 5,000 fans who would pay the face price. Four in five miss out whatever the method; the question is only which four.\n\nThe "who gets the money" push-on often surprises students: under a fixed low price with resale, the reseller keeps the gain; under a high price, the band does; under a lottery with non-transferable tickets, the lucky fan does. A strong student says which of these they mind and why.\n\nWeak moves: treating "fair" as obvious; assuming high prices are always exploitative or always efficient; ignoring the resale market; a both-sides summary without choosing a method.\n\nGood push-ons: banning resale (what happens next); named non-transferable tickets; whether the same logic applies to scarce things like hospital beds or university places, and why it might not.',
  related: ["rent-cap-day-after", "organ-allocation", "fairness-three-principles"],
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
