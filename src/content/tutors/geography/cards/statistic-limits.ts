// Draft, fleshed out from the owner's briefing and standard A-level geography. Never served until the owner approves it.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "statistic-limits",
  tutor: "geography",
  strand: "human",
  tags: ["methods", "statistics", "place", "data", "measurement"],
  status: "draft",
  opening: "What can a statistic about a place never tell you?",
  live: "Hook: two towns have exactly the same average income, but in one almost everyone earns near the middle and in the other a few are very rich and many are poor. The tension: a statistic makes a place easy to compare, but it can only count what someone chose to measure, inside boundaries someone chose. Push on: what could two places with the same figure still differ in? Who decided what counts and where the boundary falls, and would the figure change if the boundary moved? What does a statistic make easy to see, and what does it make easy to ignore? Is a number more trustworthy than a person's account, or less, or does it depend? Ask the student to start from a place they know. Aim for a position, not a list of limits.",
  deep: "Underlying argument: a statistic about a place is an answer to a question someone asked, using definitions and boundaries someone decided. An average hides the spread around it, so two places with the same average can be very different. A figure for an area describes the area as a whole, and may not be true of any one person in it. The boundary changes the result: a different line on the map can group people differently and change the number. Some things are easier to count than others, so what is measured can come to count for more than what matters. Statistics are not useless, because they let us see patterns no single account can, and a strong answer says what each kind of evidence is good for.\n\nPositions to test: what the number leaves out; who chose the measure and the boundary, and for what purpose; whether a different boundary would change the picture; what combining a statistic with personal accounts or local knowledge adds, and whether either is more reliable; what it means for a pattern in an area to be true of a person; when a statistic is fit for purpose and when it misleads.\n\nLink to other cards: maps making countries look uniform; postcodes as predictors; labels such as developing; how scientists work out past temperature from indirect evidence.\n\nWeak moves to watch: treating a country or community as uniform; treating a number as the whole truth or as worthless; listing limitations with no position; assuming a problem must be solved at the same scale as its cause; retreating to a memorised case study; a both-sides summary without reaching a position; conceding as soon as challenged, or repeating the same point more loudly.",
  related: ["map-hides", "inequality-postcode", "developing-who-decides", "past-temperature", "same-virus-different-pandemics"],
  sources: [
    {
      title: "Dr River wider course, Methods: What can a statistic about a place never tell you?",
      kind: "question",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default card;
