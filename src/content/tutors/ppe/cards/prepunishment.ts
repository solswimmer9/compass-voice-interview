// DRAFT from Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "prepunishment",
  tutor: "ppe",
  strand: "philosophy",
  tags: ["punishment", "desert", "prediction", "liberty"],
  status: "draft",
  opening:
    "If a perfectly reliable machine predicted a murder tomorrow, could it be just to punish the person today?",
  live: "Hook: imagine a machine that never gets predictions wrong says someone will commit murder tomorrow. The tension: punishment seems to require that someone has done something, yet waiting means a death we could have prevented. Push on: if punishing them today prevents the murder, the prediction was false; does that make the case incoherent? Is locking someone up to prevent harm morally different from punishing them, even if they lose the same liberty? Separate prevention from deserved punishment, and certainty from probability.",
  deep: "From Alex Kaiserman, \"What's Wrong with Prepunishment?\", Pacific Philosophical Quarterly 104(3), 2023. In our own words: the paper asks whether punishing someone before they commit a crime is necessarily wrong, testing objections from knowledge, desert, deterrence, time and duty. It separates principle from practice: the conditions that could justify prepunishment are extremely unlikely ever to hold, but advance punishment need not be wrong in every conceivable case.\n\nThe pack's practice note: separate prevention from deserved punishment, and certainty from probability; examine the consistency of the hypothetical.\n\nA strong student spots the self-defeating structure: if punishment stops the act, the prediction fails, so the machine cannot be perfectly reliable about acts that punishment prevents. They may then reformulate (the machine predicts what you would do unless stopped). Desert: can you deserve punishment for something you have not yet done? Preventive detention (as with dangerous people who have not offended) shows we already accept some loss of liberty without guilt, which the student should notice.\n\nWeak moves: \"you can't punish someone for something they haven't done\" with no reason; treating prediction and certainty as the same; ignoring preventive detention. The student is not expected to know the paper.",
  related: ["legal-but-wrong", "rights-outweigh-benefit", "machine-in-pain"],
  sources: [
    {
      title: "What's Wrong with Prepunishment? (2023)",
      url: "https://onlinelibrary.wiley.com/doi/10.1111/papq.12435",
      kind: "paper",
      authors: ["Alex Kaiserman"],
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
