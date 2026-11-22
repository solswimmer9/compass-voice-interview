// DRAFT. Written by Claude for Solomon's review; own words, no outside sources used.
// Fleshed out for review on 2026-11-12. Still a draft: students never hear it until it is approved.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "machine-in-pain",
  tutor: "ppe",
  strand: "philosophy",
  tags: ["mind", "ai", "knowledge", "evidence"],
  status: "approved",
  opening: "If a machine says it is in pain, how could you tell whether it is?",
  live: 'Hook: a chatbot tells you it is suffering and asks you not to switch it off. The tension: we only ever see other people\'s behaviour, never their feelings, yet we are confident other people feel pain. Push on: what is your evidence that your best friend feels pain? Does that same evidence apply to the machine, and if not, what is the difference? If the answer is "it is just following its programming", ask whether a brain is doing anything different. Change a condition: what if it were made of living cells, or never said anything but flinched?',
  deep: 'An epistemology question in disguise: the problem of other minds. The student should notice that the evidence for anyone\'s pain is indirect (behaviour, reports, similarity of body and origin) and ask which of those the machine shares.\n\nLines a student may reach: argument from similarity (other humans are built like me, so they probably feel like me; the machine is not); behaviour is enough (if it acts in every way as if in pain, denying it is arbitrary); origin matters (it was designed to produce the words, so the words are not evidence). Each has a counter: similarity is a matter of degree (animals); behaviour can be faked (actors); human words are also produced by a mechanism.\n\nThe two changed conditions pull apart the evidence: living cells raise similarity of body without words; flinching gives behaviour without report. A strong student says which change moves them and why, and so finds out which kind of evidence they were really relying on.\n\nA practical turn worth making late on: under uncertainty, what should we do? The cost of wrongly ignoring real suffering differs from the cost of wrongly being kind to a machine; a strong student can weigh the two without claiming to have settled the facts.\n\nWeak moves: asserting "machines cannot feel" as a fact without reasons; treating the question as one about current technology only; using "conscious", "aware" and "intelligent" interchangeably.\n\nGood push-ons: whether a fish or an insect is an easier or harder case; what single observation would change the student\'s mind.',
  related: ["practical-belief-freedom", "changing-your-mind", "rights-outweigh-benefit"],
  sources: [
    {
      title: "Compass practice question and notes, written by Claude (no outside source)",
      kind: "question",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-22",
};

export default card;
