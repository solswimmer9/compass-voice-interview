// Practice readings: articles colleges say they used in interviews, read before a practice
// interview on them. We only link to them; we never copy the article text. Context and questions
// are our own. Each reading belongs to one subject; a subject offers readings once it has some
// (see readingsFor and src/lib/subjects.ts). Geography and PPE have readings, and their relay
// paths run reading interviews; any other subject's readings also need server work.
import type { SubjectId } from "./subjects.ts";

export type Reading = {
  id: string;
  subject: SubjectId;
  title: string;
  source: string;
  url: string;
  /** True when url is a search for the exact title rather than a direct link. */
  searchLink?: boolean;
  usedIn: string;
  context: string;
  questions: string[];
  /** The tutor's own angles to raise in the interview. Never shown on the page. */
  tutorThoughts: string[];
};

function search(title: string, source: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${title}" ${source}`)}`;
}

export const READINGS: Reading[] = [
  {
    subject: "geography",
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
      "The word 'invasive' does a lot of moral work. Few people now think of the rabbit or the sycamore in Britain as invasive, though both were introduced. When does an outsider become part of a place?",
      "If the hippos fill the role of animals that went extinct thousands of years ago, the argument quietly assumes some past state of nature is the 'right' one. Which past, and who chooses it?",
      "Ask whose view is missing: fishers and farmers who share the river with an animal weighing well over a tonne may see a safety and livelihood question, not an ecology debate.",
      "The story only exists because of a drug lord. Should the way something arrived affect how we judge its effects?",
    ],
  },
  {
    subject: "geography",
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
    subject: "geography",
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
    subject: "geography",
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
      "The essay's strongest point may be that cheap energy lifted billions out of poverty. Then ask the student to test whose 'progress' it counts: are the people who gained most the same people most exposed to the costs?",
      "Words matter here. 'Crisis', 'emergency' and 'by-product' each frame what action seems reasonable. Ask the student what each word licenses.",
      "Stay strictly neutral on the politics. Test the student's reasoning equally whichever side they take.",
    ],
  },
  {
    subject: "ppe",
    id: "tilley-neighbourhoods",
    title:
      "The effect of politically homogenous neighbourhoods on affective polarization: Evidence from Britain",
    source: "European Journal of Political Research (Tilley and Hobolt)",
    url: "https://onlinelibrary.wiley.com/doi/full/10.1111/1475-6765.12720",
    usedIn: "Recent research by an Oxford PPE tutor",
    context:
      "People on opposite sides of politics increasingly dislike and distrust each other, which political scientists call affective polarization. A popular explanation is the 'Big Sort': people now live among neighbours who vote like them, so they rarely meet the other side. James Tilley and Sara Hobolt test this with British survey data. People can tell whether their area leans one way, but living in a one-sided area is not linked to disliking the other side more, whether the divide is party or Leave and Remain. It is a short, free research note; the abstract, introduction and conclusion fit in 15 minutes.",
    questions: [
      "What is the 'Big Sort' explanation of polarization, and what do the authors find?",
      "Why might you expect living among people who agree with you to make you dislike the other side?",
      "The paper finds no link. Does that prove where you live has no effect on how you feel about opponents?",
      "If neighbours don't explain polarization, what else might? How would you test it?",
      "Would mixing neighbourhoods politically be a good policy even if it didn't reduce hostility?",
    ],
    tutorThoughts: [
      "A finding of 'no correlation' is easy to over-read. Push the student on what it does and does not rule out: perhaps the effect is real but small, or works through other routes such as family, work or school.",
      "Ask where people actually meet political opponents now. If politics is mostly encountered online or through the news, why would the street matter much?",
      "There is a selection puzzle: people may choose where to live partly by politics. Ask how that would complicate any study of neighbourhood effects.",
      "Test whether the student can separate disagreeing with people from disliking them. Is affective polarization always bad, or can strong dislike of some views be reasonable?",
    ],
  },
  {
    subject: "ppe",
    id: "butt-climate-history",
    title: "Immoderate Integrationism: History and Climate Justice",
    source: "Erasmus Journal for Philosophy and Economics (Daniel Butt)",
    url: "https://ejpe.org/journal/article/view/1016",
    usedIn: "Recent research by an Oxford PPE tutor",
    context:
      "Who should pay for the damage climate change causes? One answer is 'the polluter pays': countries that emitted the most should compensate those harmed. Daniel Butt, a political philosopher at Balliol, responds to a recent book that takes this historical approach but keeps it narrow. He argues that if we take history seriously, we cannot stop at past emissions: other historical wrongs, such as colonial exploitation, and a wider range of remedies come into view too. He also asks whether ambitious principles of justice help or get in the way when the climate crisis needs fast, workable action. It is free to read; for 15 minutes, read the opening and closing sections.",
    questions: [
      "What does 'the polluter pays' mean for climate change, and what is Butt adding to it?",
      "Can people alive today owe something for emissions made before they were born?",
      "If a country got rich partly through past wrongs, does it owe more than one that did not, even if both pollute the same today?",
      "Should what is politically achievable change what justice requires, or only what we can do about it?",
      "Who exactly should pay: governments, companies, or citizens through taxes?",
    ],
    tutorThoughts: [
      "Separate four reasons someone might owe something: they caused the harm, they benefited from it, they belong to a group that continues over time, or they simply can afford to help. Ask which the student is relying on.",
      "Many past emitters did not know about climate change. Push on whether ignorance removes responsibility, or only blame.",
      "Butt widens the history beyond climate. Test whether that strengthens the case for repair, or makes it so large that it can never be settled.",
      "Ask the feasibility question directly: if a narrower theory would actually get money to flood victims sooner, is it the better theory or just the more convenient one?",
      "Stay neutral on reparations as a political issue. Test the reasoning equally whichever side the student takes.",
    ],
  },
  {
    subject: "ppe",
    id: "moneke-nutrient",
    title: "Combatting nutrient pollution through the housing market",
    source: "Working paper (Bakker and Moneke)",
    url: "https://niclasmoneke.com/wp-content/uploads/Bakker_Moneke-Combatting_Nutrient_Pollution-2026.pdf",
    usedIn: "Recent research by an Oxford PPE tutor",
    context:
      "In parts of England, new homes may only be built if they add no extra nutrient pollution to rivers, a rule called Nutrient Neutrality. Economists Jan David Bakker and Niclas Moneke measure what it did. Water quality improved a little, but fewer homes were finished, prices rose and building moved to nearby areas. Places that set up offset schemes, where developers pay to cut pollution elsewhere, got cleaner water and lost fewer homes. It is a working paper, not yet published in a journal; for 15 minutes, read the first page and the conclusion.",
    questions: [
      "What did the Nutrient Neutrality rule try to do, and what do the authors find it actually did?",
      "Most river pollution comes from farming and sewage, not new homes. Is it fair to put the cost on housing?",
      "Why might building simply move to neighbouring areas, and why does that matter?",
      "How could the authors tell what the rule caused, rather than what would have happened anyway?",
      "Why might offset schemes work better in some places than others?",
    ],
    tutorThoughts: [
      "Push on fairness against convenience: housing is easy to regulate because it needs permission, while farms and sewage are harder. Is it right to make costs follow what is easy to control rather than who causes the harm?",
      "The trade-off is real on both sides: cleaner rivers matter, and so do homes for people who cannot afford one. Ask the student to weigh them, not wave one away.",
      "Ask how anyone can know what would have happened without the rule. Comparing affected and unaffected areas only works if they were alike to begin with.",
      "The paper's lesson is partly about state capacity: the same rule worked better where councils could run offset schemes. Ask whether a good policy on paper can be a bad one in practice.",
      "Note it is a working paper, not yet through peer review. Ask how much weight that should carry.",
    ],
  },
  {
    subject: "ppe",
    id: "ansell-housing",
    title: "The UK's Political Housing Crisis",
    source: "Ben Ansell, Substack",
    url: "https://benansell.substack.com/p/the-uks-political-housing-crisis",
    usedIn: "Picked for PPE applicants",
    context:
      "Ben Ansell, an Oxford professor of politics, asks why Britain builds so few homes when almost everyone agrees there is a housing shortage. Using large YouGov surveys and a modelling method called MRP, he estimates support for new homes in every constituency. Only around 38% of people support more homes being built locally, and support is lowest where most people own their homes and vote Conservative. It is a sharp example of how what voters want can stop a government from fixing a problem everyone can see.",
    questions: [
      "What is Ansell's main argument, and what evidence does he use for it?",
      "Why might homeowners oppose new houses near them, even if they agree the country needs more?",
      "Is it fair for people who already live somewhere to decide whether others can move there?",
      "If most voters oppose local building, should a democratic government build anyway?",
      "MRP estimates opinion in places the survey barely covered. How far would you trust it?",
    ],
    tutorThoughts: [
      "Everyone can agree the country needs more homes and still oppose them locally. Is that hypocrisy, or a reasonable response to who bears the costs (traffic, building work, crowded services) and who gets the benefits?",
      "Homeowners gain when prices rise, and they vote more. Push on whether a democracy can fix a problem when the people who would gain from fixing it are under-represented: renters, young people, people who have not moved there yet.",
      "Challenge the method: MRP fills in places from demographics, so it partly assumes the pattern it finds. What would the student need to see before trusting a single constituency's number?",
      "Ask what would change the politics: paying local residents, building new towns, taking planning away from councils. Each answer has its own trade-off between local consent and national need.",
      "Stay strictly neutral on parties. Test the reasoning equally whichever side the student takes.",
    ],
  },
  {
    subject: "ppe",
    id: "eu-discontent",
    title: "The geography of EU discontent",
    source: "Regional Studies (Dijkstra, Poelman and Rodríguez-Pose)",
    url: "https://www.tandfonline.com/doi/full/10.1080/00343404.2019.1654603",
    usedIn: "Picked for PPE applicants",
    context:
      "Three economists map votes for parties opposed to the European Union across more than 63,000 local areas in all 28 member states. The usual story is that 'left-behind' people, older, poorer and less educated, drive the anti-EU vote. They find something more specific: what matters most is long-term economic and industrial decline in a place, along with low education and few jobs. Once decline is accounted for, richer places vote more anti-EU than poorer ones. It is free to read; the abstract, introduction and conclusions are enough for 15 minutes.",
    questions: [
      "What is the paper's main finding, and how does it differ from the 'left-behind people' story?",
      "Why might a place that used to be prosperous turn against the EU more than a place that was always poor?",
      "The paper shows a link between decline and anti-EU voting. Does that prove decline causes it?",
      "Is a vote driven by economic decline less legitimate than one driven by views about sovereignty or identity?",
      "If you were a government, what would this paper suggest you do, and what might it miss?",
    ],
    tutorThoughts: [
      "The surprise is that it is declining places, not simply poor people, that turn against the EU. Ask why losing something might matter more than never having had it.",
      "Correlation is not causation: the authors argue reverse causation is unlikely, but test whether the student can think of anything else that could explain both decline and the vote.",
      "There is an awkward question about voters' reasons: if economic decline predicts the vote, are voters wrong about the cause of their problems, or is the EU fairly blamed? Be careful the student does not dismiss voters as simply mistaken.",
      "Districts are places, not people. Ask what this kind of data can and cannot say about why any one person voted as they did.",
      "Stay strictly neutral on Brexit and the EU. Test the reasoning equally whichever side the student takes.",
    ],
  },
];

export const READING_MINUTES = 15;

/** A reading by id; with a subject, only that subject's readings count. */
export function readingById(id: unknown, subject?: SubjectId): Reading | undefined {
  if (typeof id !== "string") return undefined;
  return READINGS.find((reading) => reading.id === id && (!subject || reading.subject === subject));
}

/** The readings a subject offers, in display order. Empty when it has none yet. */
export function readingsFor(subject: SubjectId): Reading[] {
  return READINGS.filter((reading) => reading.subject === subject);
}
