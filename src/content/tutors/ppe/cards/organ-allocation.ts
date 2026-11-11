// Approved by Solomon Allen on 2026-11-11. From Solomon's PPE interview pack (11 November 2026), restructured by Claude.
// Questions are the pack's original practice questions; summaries are in our own words.
import type { TopicCard } from "../../../types.ts";

const card: TopicCard = {
  id: "organ-allocation",
  tutor: "ppe",
  strand: "philosophy",
  tags: ["medical-ethics", "allocation", "fairness"],
  status: "approved",
  opening: "Who should receive a life-saving kidney when there are not enough to go round?",
  live: "Hook: one kidney, several patients who need it. The tension: we could maximise the years of life saved, give everyone an equal chance, or prioritise whoever is worst off, and these point to different patients. Push on: ask what each principle values and where it clashes with another. Should organs go to whoever will gain most expected life-years? What if the patient with fewer expected years is much worse off? Is a lottery fair when patients have unequal chances of benefiting? Does fairness concern the procedure, the outcome, or both? Could willingness to pay ever be a fair way to allocate healthcare?",
  deep: "From the What? Why? When? episode Medical Ethics (Jesus College Oxford, hosted by Matt Williams), which discusses organ allocation using consequentialist, duty-based and virtue-ethical approaches, and the pack's questions MWQ01, MWQ02 and MWQ18. The pack's exercise: compare equal chances, greatest expected medical benefit and priority to the worst off.\n\nMaximising expected life-years treats every year as equal, which favours younger and healthier recipients and can disadvantage the already unlucky. Equal chances (a lottery) respects each person equally but ignores how much good the organ will do. Priority to the worst off focuses on need but may waste scarce organs on poor matches.\n\nProcedure versus outcome: a lottery can be fair as a procedure even if outcomes are unequal; a student should notice this distinction. Willingness to pay: separates efficiency from fairness, since ability to pay reflects income as well as need.\n\nWeak moves: \"it depends on the case\" without a principle; treating age or lifestyle as obviously relevant or irrelevant; ignoring that someone must lose.",
  related: ["fairness-three-principles", "rights-outweigh-benefit", "ticket-prices-fair"],
  sources: [
    {
      title: "What? Why? When? (Jesus College Oxford): Medical Ethics (publisher description)",
      url: "https://shows.acast.com/what-why-when/episodes/686be4a7adc6a61ba8e5d1a0",
      kind: "podcast",
      authors: ["Matt Williams"],
    },
    {
      title: "Solomon's PPE interview pack (11 November 2026): original practice questions",
      kind: "notes",
    },
  ],
  reviewedBy: "Solomon Allen",
  reviewedAt: "2026-11-11",
};

export default card;
