// Practice readings: articles Keble College (Oxford) says it used in geography interviews.
// We only link to them; we never copy the article text. Context and questions are our own.

export type Reading = {
  id: string;
  title: string;
  source: string;
  url: string;
  /** True when url is a search for the exact title rather than a direct link. */
  searchLink?: boolean;
  usedIn: string;
  context: string;
  questions: string[];
  /** Dr River's own angles to raise in the interview. Never shown on the page. */
  tutorThoughts: string[];
};

function search(title: string, source: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${title}" ${source}`)}`;
}

export const READINGS: Reading[] = [
  {
    id: "escobar-hippos",
    title: "Could Pablo Escobar's escaped hippos help the environment?",
    source: "National Geographic",
    url: search("Could Pablo Escobar's escaped hippos help the environment", "National Geographic"),
    searchLink: true,
    usedIn: "Keble College, Oxford, 2025 interviews",
    context:
      "In the 1980s the drug lord Pablo Escobar kept a few hippos on his ranch in Colombia. After his death they were left behind, escaped into the Magdalena River and have multiplied. Scientists disagree about them: some treat them as a damaging invasive species, others argue they may partly fill a gap left by large animals that went extinct thousands of years ago. The article sits on a big geographical question: what counts as natural, and who decides what belongs in a place.",
    questions: [
      "What is the article's main argument, and how strong is the evidence for it?",
      "Is an animal that people brought somewhere ever 'native'? How long would it take?",
      "If hippos replace the role of extinct animals, does it matter how they got there?",
      "Who gains and who loses from the hippos: scientists, farmers, fishers, tourists, the river?",
      "What would you need to measure to decide whether the hippos are good or bad for the river?",
    ],
    tutorThoughts: [
      "The word 'invasive' does a lot of moral work. Nobody calls the English rabbit or the sycamore invasive any more. When does an outsider become part of a place?",
      "If the hippos fill the role of animals that went extinct thousands of years ago, the argument quietly assumes some past state of nature is the 'right' one. Which past, and who chooses it?",
      "The local view is missing from most coverage: fishers and farmers who share the river with a three-tonne animal see a safety and livelihood question, not an ecology debate.",
      "The story only exists because of a drug lord. Should the way something arrived affect how we judge its effects?",
    ],
  },
  {
    id: "ai-environment",
    title: "AI is bad for the environment, and the problem is bigger than energy consumption",
    source: "The Conversation",
    url: "https://theconversation.com/ai-is-bad-for-the-environment-and-the-problem-is-bigger-than-energy-consumption-247842",
    usedIn: "Keble College, Oxford, 2025 interviews",
    context:
      "Most debate about AI and the environment is about electricity. This article argues the footprint is wider: the water used to cool data centres, the minerals mined for chips, the land data centres occupy, and the places that bear those costs. It is a good example of geography's habit of following a product back to the places and people it depends on.",
    questions: [
      "Beyond energy, what other environmental costs does the article identify? Which do you find most convincing?",
      "Where in the world do these costs fall, and is that the same place that gets the benefits?",
      "Could AI also help the environment? How would you weigh that against its costs?",
      "Is it fair to judge a technology by its environmental footprint alone?",
      "If you were writing a rule for where new data centres can be built, what would it say?",
    ],
    tutorThoughts: [
      "The cloud sounds weightless, but it is concrete, copper, water and land. Geography is good at making invisible infrastructure visible again.",
      "The costs and benefits of AI often land in different places: a data centre's water use in a dry region, mining for chips far from the users who benefit. That mismatch is a classic geographical question.",
      "There is a scale problem: one AI query is tiny, billions add up. Is it fair to ask individuals to feel guilty, or is this a question for governments and companies?",
      "Push back the other way too: if AI helps model floods or design better batteries, how would you even weigh that against its footprint?",
    ],
  },
  {
    id: "tipping-points",
    title: "What climate tipping points are and how they could suddenly change our planet",
    source: "The Conversation",
    url: "https://theconversation.com/what-climate-tipping-points-are-and-how-they-could-suddenly-change-our-planet-49405",
    usedIn: "Keble College, Oxford, 2025 interviews",
    context:
      "A tipping point is when a system changes slowly, then suddenly shifts into a very different state that is hard to reverse, such as ice sheets collapsing or a rainforest turning into savanna. The article explains the idea and some examples. It links physical geography (how systems behave) with human geography (how we plan for risks that are uncertain but serious).",
    questions: [
      "In your own words, what is a tipping point, and how is it different from gradual change?",
      "Which example in the article worries you most, and why?",
      "How can scientists know a tipping point exists before we have crossed it?",
      "If we can't be sure when a tipping point will happen, how should governments plan for it?",
      "Can you think of a tipping point in a human system, such as a town, a market or a fashion?",
    ],
    tutorThoughts: [
      "Tipping points break a comfortable assumption: that change is gradual, so we will notice in time and adjust.",
      "There is a strange politics to uncertainty. Not knowing exactly when a threshold arrives is used both as a reason to act now and as a reason to wait.",
      "Human systems tip too: high streets, housing markets, a town losing its main employer. Do the same ideas carry over, or is that a stretch?",
      "Ask how anyone can know a threshold exists before crossing it: past climates, models and analogues all have limits.",
    ],
  },
  {
    id: "progress-not-crisis",
    title:
      "Climate change is a by-product of progress, not an existential crisis, says Trump's energy czar",
    source: "The Economist",
    url: search(
      "Climate change is a by-product of progress, not an existential crisis",
      "The Economist",
    ),
    searchLink: true,
    usedIn: "Keble College, Oxford, 2025 interviews",
    context:
      "A guest essay by Chris Wright, the US Secretary of Energy and a former oil and gas executive. He accepts the climate is warming but argues it is a side effect of the energy that made people richer and healthier, and that treating it as an existential crisis does more harm than good. It is deliberately provocative, and a good test of judging an argument on its reasoning rather than whether you agree with it.",
    questions: [
      "What exactly is the author arguing, and what does he accept about climate change?",
      "What is the strongest point in his argument, even if you disagree with it?",
      "Whose experience of climate change is missing from the argument?",
      "Does it matter who wrote this? How should we treat an argument from someone with an interest in the outcome?",
      "Is 'progress' the same for everyone? Who has gained most from cheap energy, and who pays the costs?",
    ],
    tutorThoughts: [
      "Separate the argument from the author. A former oil and gas executive making this case is worth noticing, but it does not by itself make the argument wrong. Judge the reasoning.",
      "The essay's strongest point may be that cheap energy lifted billions out of poverty. Its weakest may be whose 'progress' it counts: those who gained most are often not those most exposed to the costs.",
      "Words matter here. 'Crisis', 'emergency' and 'by-product' each frame what action seems reasonable. Ask the student what each word licenses.",
      "Stay strictly neutral on the politics. Test the student's reasoning equally whichever side they take.",
    ],
  },
];

export const READING_MINUTES = 15;

export function readingById(id: unknown): Reading | undefined {
  return typeof id === "string" ? READINGS.find((reading) => reading.id === id) : undefined;
}
