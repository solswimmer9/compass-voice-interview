import { describe, expect, it } from "vitest";

import { cardsFor, isTutorAvailable, LIMITS, tutorById } from "@/content";
import { selectCards } from "@/content/select-cards";
import { countWords } from "@/content/words";
import { buildPpeTrialSession, ppeFeedbackContext, ppeTutor } from "@/lib/ppe-trial.server";

describe("PPE trial content", () => {
  it("approves only the nine cards Solomon reviewed; the rest stay drafts", () => {
    expect(
      cardsFor("ppe")
        .map((card) => card.id)
        .sort(),
    ).toEqual([
      "democracy-and-growth",
      "fairness-three-principles",
      "housing-water-pollution",
      "infrastructure-veto",
      "mixed-neighbourhoods",
      "organ-allocation",
      "political-myth",
      "prepunishment",
      "welfare-cuts-fair",
    ]);
    expect(isTutorAvailable("ppe")).toBe(true);
    for (const card of selectCards(ppeTutor())) expect(card.status).toBe("approved");
    expect(ppeTutor().cards.some((card) => card.status === "draft")).toBe(true);
  });

  it("covers all three strands", () => {
    const strands = new Set(ppeTutor().cards.map((card) => card.strand));
    expect([...strands].sort()).toEqual(["economics", "philosophy", "politics"]);
  });

  it("builds a Prof Matt session within the live budget for every opening card", async () => {
    const tutor = ppeTutor();
    for (let turn = 0; turn < tutor.cards.length; turn++) {
      const session = await buildPpeTrialSession({ openingTurn: turn });
      expect(session.tutorId).toBe("ppe");
      expect(session.cardIds).toHaveLength(3);
      expect(session.opening).toContain("Prof Matt");
      expect(session.opening).toContain("Oxford-style PPE");
      expect(new TextEncoder().encode(session.opening).length).toBeLessThan(LIMITS.openingBytes);
      expect(countWords(session.liveInstructions)).toBeLessThanOrEqual(
        LIMITS.liveInstructionsWords,
      );
      expect(session.liveInstructions).not.toContain("Dr River");
    }
  });

  it("rotates the opening card by openingTurn", async () => {
    const a = await buildPpeTrialSession({ openingTurn: 0 });
    const b = await buildPpeTrialSession({ openingTurn: 1 });
    expect(a.cardIds[0]).not.toBe(b.cardIds[0]);
  });

  it("restricts to a strand when asked and ignores unknown strands", async () => {
    const economics = await buildPpeTrialSession({ openingTurn: 0, strand: "economics" });
    for (const id of economics.cardIds) {
      expect(tutorById("ppe")?.cards.find((card) => card.id === id)?.strand).toBe("economics");
    }
    const unknown = await buildPpeTrialSession({ openingTurn: 0, strand: "history" });
    expect(unknown.cardIds).toHaveLength(3);
  });

  it("limits feedback notes to the interview's cards, ignoring unknown ids", () => {
    const context = ppeFeedbackContext(["museum-entry-free", "river-person", 4]);
    expect(context).toContain("[museum-entry-free]");
    expect(context).not.toContain("[river-person]");
    expect(context).not.toContain("[bag-charge]");
    expect(ppeFeedbackContext()).toContain("[bag-charge]");
  });
});
