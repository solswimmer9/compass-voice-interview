// DRAFT from Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "schooling-for-marriage",
  tutor: "ppe",
  strand: "economics",
  tags: ["education", "beliefs", "development", "autonomy"],
  status: "draft",
  opening:
    "If parents keep daughters in school mainly to improve their marriage prospects, is the extra schooling a success?",
  live: "Hook: in one study of families in rural India, a model built on parents' answers suggested that if education stopped improving a daughter's marriage prospects, far fewer girls would still be in school at sixteen. The tension: more schooling is usually counted as a win, but the motive here is not the girl's own choice. Push on: how would we tell parents' beliefs about the returns to education apart from how much they value education for its own sake? Could a policy that changes marriage expectations increase schooling while reducing girls' autonomy? Is a model's \"what if\" the same as an observed result?",
  deep: "From Alison Andrew and Abi Adams, \"Revealed Beliefs and the Marriage Market Return to Education\", Quarterly Journal of Economics 140(3), 2025. In our own words: they develop a way to estimate subjective beliefs from hypothetical-choice surveys by varying the information given about future outcomes, and apply it to Rajasthani parents' beliefs about girls' marriage age, education and match quality. In their model, removing the perceived marriage-market return to education cuts the number of girls still in school at 16 by about 60%, with almost none continuing to 18; their survey responses accurately predicted actual schooling five years later. The pack notes the 60% figure is a model simulation, not the result of an experiment.\n\nThe pack's practice: separate outcomes, motives and agency; distinguish model-based counterfactuals from observed effects.\n\nA strong student asks what \"success\" means: outcomes (more years in school, more skills) versus agency (the girl's own goals). Education might empower a girl later even if chosen for marriage reasons. Beliefs versus preferences: two families may both keep a daughter in school for different reasons; varying information is a way to tell them apart.\n\nWeak moves: judging parents' motives harshly without understanding constraints; treating a simulation as observed fact; ignoring the girl's perspective.",
  related: ["resisting-education", "democracy-and-growth", "what-is-a-problem"],
  sources: [
    {
      title: "Revealed Beliefs and the Marriage Market Return to Education (2025)",
      url: "https://academic.oup.com/qje/article/140/3/2107/8113989",
      kind: "paper",
      authors: ["Alison Andrew", "Abi Adams"],
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
