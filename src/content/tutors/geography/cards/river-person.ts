// Restructured from question line 1 and the Charpleix and Delaney notes bullets in
// src/lib/interview-briefing.ts. Copy this file to start a new card.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "river-person",
  tutor: "geography",
  strand: "human",
  tags: ["law", "rivers", "indigenous-knowledge", "personhood", "new-zealand"],
  status: "approved",
  opening: "Can a river be a person?",
  live: 'Hook: in 2017 New Zealand recognised the Whanganui River as a legal person, reflecting the Māori view of the river as a living ancestor. The tension: there are two ways of knowing one river, and only one of them has the power to make the rules. Push on: what changes in practice, and who speaks for the river? Does writing this into the state\'s own law respect the Māori view or absorb it? Rules shape places and places shape rules: where else does a rule change what a place is, such as a park bylaw or a "no ball games" sign?',
  deep: 'Underlying argument (Charpleix, on legal personhood and legal pluralism): the Whanganui settlement brings together two ways of knowing one river. In the Māori view the river is a living ancestor; in state law it is now a legal person. Only one of those systems has the power to make and enforce rules, so recognising the river in the state\'s own legal terms can be read either as respect for the Māori view or as absorbing it into the state\'s categories. A related idea from the notes (Delaney): law and space shape each other. Rules shape places, and places shape rules; school corridors, park bylaws and "no ball games" signs are everyday versions.\n\nQuestions that test the position: what actually changes in practice once the river is a legal person, and who speaks for it.\n\nWeak moves to watch: treating the Māori community or the state as one uniform view; treating "natural" as politically neutral; retreating to a memorised case study; giving a both-sides summary without reaching a position.',
  related: ["regeneration-who-for", "volcano-eruption-styles"],
  sources: [
    { title: "Dr River question line: Can a river be a person?", kind: "question" },
    {
      title: "Charpleix (2018), on the Whanganui River",
      kind: "paper",
      authors: ["Charpleix"],
    },
    {
      title: "Solomon's Part II geography notes: rules shape places",
      kind: "notes",
      authors: ["Delaney"],
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-10",
};

export default card;
