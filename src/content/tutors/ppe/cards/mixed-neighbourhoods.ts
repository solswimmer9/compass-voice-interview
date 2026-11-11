// Approved by Solomon Allen on 2026-11-11. From Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "mixed-neighbourhoods",
  tutor: "ppe",
  strand: "politics",
  tags: ["polarisation", "neighbourhoods", "causation", "evidence"],
  status: "approved",
  opening:
    "Would making neighbourhoods more politically mixed reduce hostility between political groups?",
  live: "Hook: people increasingly dislike those who vote the other way, and one popular explanation is that we live surrounded by people who agree with us. The tension: one large British study found people can tell how politically uniform their area is, but living in such an area is not linked to disliking the other side more. Push on: does the absence of a link prove neighbourhoods have no causal effect? What else could hide an effect? Could online networks matter more than neighbours, and how would the student test that?",
  deep: 'From James Tilley and Sara B. Hobolt, "The effect of politically homogenous neighbourhoods on affective polarization: Evidence from Britain", European Journal of Political Research 64(2), 2025 (online 2024). In our own words: using British data, they find people accurately perceive how politically homogeneous their area is, but neighbourhood homogeneity is not correlated with any measure of affective polarisation, robust to partisanship or Brexit identity, level of geography, length of residence and controls. They conclude geographical sorting is unlikely to be a major cause of affective polarisation.\n\nThe pack\'s practice: test the claim that no correlation means no causation. A strong student sees that zero correlation is strong evidence against a large effect, but an effect could be masked if, for example, people who move to like-minded areas were already less hostile, or effects offset each other. They might suggest tests: people who move for reasons unrelated to politics; changes over time.\n\nOnline networks: a rival explanation; testable by comparing heavy and light users, or natural experiments such as internet roll-outs.\n\nWeak moves: assuming segregation must cause hostility; treating one study as final; confusing perception of the area with its effect. The student is not expected to know the study.',
  related: ["testing-election-causes", "climate-concern-polarised", "distrust-the-messenger"],
  sources: [
    {
      title: "The effect of politically homogenous neighbourhoods on affective polarization (2025)",
      url: "https://onlinelibrary.wiley.com/doi/full/10.1111/1475-6765.12720",
      kind: "paper",
      authors: ["James Tilley", "Sara B. Hobolt"],
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
