// Restructured from question line 13, the physical-processes line and the "Why build a city
// next to a volcano?" extra question in src/lib/interview-briefing.ts.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "volcano-eruption-styles",
  tutor: "geography",
  strand: "physical",
  tags: ["volcanoes", "hazards", "plate-tectonics", "classification"],
  status: "approved",
  opening: "Why do some volcanoes ooze and others explode?",
  live: "Hook: compare the gentle shield volcanoes of Hawaii, a steep cone like Mount St Helens, small cinder cones and huge calderas like Yellowstone. The tension: the same basic process, molten rock reaching the surface, behaves very differently. Push on: what do the magma's stickiness and gas do? How does the plate setting shape this? Is the most explosive type also the most deadly? Do neat categories fit a real volcano? Reason from first principles, and if it fits, ask why anyone would build a city next to a volcano.",
  deep: 'Underlying argument: eruption style depends on the magma\'s stickiness and its gas, and the plate setting shapes both. Compare shield volcanoes like those of Hawaii, steep composite cones like Mount St Helens, small cinder cones and huge calderas like Yellowstone. A strong candidate reasons this through from first principles rather than reciting a table of volcano types.\n\nPositions to test: whether the most explosive type is also the most deadly, which turns on who is hit hardest; whether neat categories fit a real volcano, since categories are things people made.\n\nLink to human geography: why would anyone build a city next to a volcano? Use it to show how physical geography matters to human geography.\n\nWeak moves to watch: naming a type instead of explaining the process; treating "natural" as politically neutral when discussing who is harmed; keeping physical and human processes separate; retreating to a memorised case study.',
  related: ["disaster-natural", "hazards-city-volcano", "regeneration-who-for", "river-person"],
  sources: [
    {
      title: "Dr River question line: Why do some volcanoes ooze and others explode?",
      kind: "question",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-10",
};

export default card;
