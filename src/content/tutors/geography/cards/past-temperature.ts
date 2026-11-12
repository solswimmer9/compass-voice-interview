// Draft, fleshed out from the owner's briefing and standard A-level geography. Never served until the owner approves it.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "past-temperature",
  tutor: "geography",
  strand: "physical",
  tags: ["climate", "past-climates", "evidence", "proxies", "uncertainty"],
  status: "draft",
  opening: "How can we know the temperature of a year nobody recorded?",
  live: "Hook: nobody was reading a thermometer in most of the past, yet scientists talk about how warm or cold particular years and centuries were. The tension: we can only measure the present directly, so knowing the past means reading something else that responded to temperature. Push on: if you had no thermometer, what could have kept a record of temperature, and what would that record really be measuring? What else besides temperature could have changed it? How would you check one source against another? Is knowing the same as being certain? Let the student design the evidence before naming anything. Only if they are stuck, offer one example, such as a tree, a layer of ice or an old harvest diary, and hand the question back. Stay on how evidence works rather than on current climate politics.",
  deep: "Underlying argument: temperature in the past is inferred from proxies, things that responded to conditions at the time and kept a record. Tree rings vary with growing conditions from year to year. Layers of ice trap snow and air, and the chemistry of the ice depends on the temperature when the snow fell. Sediments in lakes and bogs hold pollen, which shows which plants grew and so roughly what the climate allowed. Written records such as diaries, harvest dates and accounts of frozen rivers cover recent centuries in some places. None of these is a thermometer, so each has to be calibrated against the period when real readings exist.\n\nPositions to test (let the student design the evidence first; offer a tree, a layer of ice or a harvest diary only if they are stuck, and also ask how far back each could reach and how finely): what each proxy actually measures, since a thin tree ring can mean cold, drought or damage; how scientists deal with that, mainly by comparing independent sources that fail in different ways; how dating works (counting layers or rings, and what happens when counting is hard); the difference between a precise record for one place and a picture of the whole planet; why a range with an uncertainty is more honest than a single number.\n\nScale: a proxy that is excellent for a single year in one valley may say little about a thousand-year average for the globe, and the reverse.\n\nCare: if the conversation turns to current climate policy or whether people should trust the science, stay on what evidence would convince the student and why, and do not share a view.\n\nWeak moves to watch: naming proxies without saying what they measure; treating a proxy as a direct thermometer; treating \"we can't be sure\" as \"we know nothing\"; keeping the question abstract instead of reasoning through one real source; retreating to a memorised fact when challenged.",
  related: ["old-ice-landscape", "weather-worse-or-exposed", "statistic-limits"],
  sources: [
    {
      title: "Dr River opening question: How can we know the temperature of a year nobody recorded?",
      kind: "question",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default card;
