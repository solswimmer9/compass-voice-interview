// DRAFT from Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
// Fleshed out for review on 2026-11-12. Still a draft: students never hear it until it is approved.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "climate-collective-action",
  tutor: "ppe",
  strand: "economics",
  tags: ["climate", "collective-action", "incentives", "free-riding"],
  status: "draft",
  opening: "Why can sensible countries collectively fail to cut emissions?",
  live: "Hook: every country gains if global emissions fall, yet each is tempted to let the others do the cutting. The tension: choices that look sensible for each country can add up to an outcome that is bad for all. Push on: ask the student to set up a simple two-country game with costs and benefits, then test a proposed treaty: what must it change about incentives? Should rich countries pay for cuts in poorer countries, and is that an efficiency argument or a fairness argument? Why might elected leaders underinvest in climate protection at all?",
  deep: "From the What? Why? When? episode What can be done for Climate Change?, whose description identifies denial, economic costs, collective-action problems and obligations between generations; and pack questions MWQ12, MWQ15 and MWQ16. The pack's exercise: make a two-country emissions game, explain why individually attractive decisions produce a collectively damaging outcome, then test a treaty.\n\nStructure: each country bears the full cost of its own cuts but gets only a share of the benefit, so free-riding is tempting (a prisoner's dilemma). A treaty must change payoffs: monitoring, penalties, side payments, or linking climate to trade.\n\nSimple numbers the tutor can offer if the student wants them, saying they are made up: cutting costs a country 3; each country's cut gives 2 to every country. If I cut, I pay 3 and get 2 back, so I lose 1 whatever you do. If we both cut, each of us pays 3 and gets 4, a gain of 1. So each does better by not cutting, yet both do better if both cut. Ask the student what a treaty must change in those numbers.\n\nRich countries financing cuts in poorer ones: efficiency (cuts may be cheaper there) differs from fairness (historical emissions, ability to pay). The pack links this to the climate-justice and politicisation papers.\n\nElected leaders: costs now, benefits later and spread across the world; voters today bear the costs; future generations do not vote.\n\nWeak moves: \"countries are selfish\" as a full explanation; ignoring that cooperation does sometimes happen; confusing moral disagreement with free-riding.",
  related: ["climate-debt-past-emissions", "climate-concern-polarised", "democracy-and-growth"],
  sources: [
    {
      title:
        "What? Why? When? (Jesus College Oxford): What can be done for Climate Change? (publisher description)",
      url: "https://shows.acast.com/what-why-when/episodes/6818c137609de352788a6312",
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
