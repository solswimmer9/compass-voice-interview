import { describe, expect, it } from "vitest";

import { cardsFor, isTutorAvailable, LIMITS, tutorById } from "@/content";
import { selectCards } from "@/content/select-cards";
import { countWords } from "@/content/words";
import { buildPpeTrialSession, ppeFeedbackContext, ppeTutor } from "@/lib/ppe-trial.server";

describe("PPE trial content", () => {
  it("keeps PPE closed to students while every card is a draft", () => {
    expect(ppeTutor().cards.length).toBeGreaterThan(0);
    expect(cardsFor("ppe")).toHaveLength(0);
    expect(isTutorAvailable("ppe")).toBe(false);
    expect(selectCards(ppeTutor())).toHaveLength(0);
  });

  it("covers all three strands", () => {
    const strands = new Set(ppeTutor().cards.map((card) => card.strand));
    expect([...strands].sort()).toEqual(["economics", "philosophy", "politics"]);
  });

  it("builds a Dr Vale session within the live budget for every opening card", async () => {
    const tutor = ppeTutor();
    for (let turn = 0; turn < tutor.cards.length; turn++) {
      const session = await buildPpeTrialSession({ openingTurn: turn });
      expect(session.tutorId).toBe("ppe");
      expect(session.cardIds).toHaveLength(3);
      expect(session.opening).toContain("Dr Vale");
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
