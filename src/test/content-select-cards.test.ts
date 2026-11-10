import { describe, expect, it } from "vitest";

import { GEOGRAPHY } from "@/content/tutors/geography";
import { selectCards } from "@/content/select-cards";
import type { TopicCard, Tutor } from "@/content/types";

function card(
  id: string,
  strand: string,
  related: string[],
  status: TopicCard["status"] = "approved",
) {
  return {
    id,
    tutor: "geography",
    strand,
    tags: ["test"],
    status,
    opening: `Question ${id}?`,
    live: `Live ${id}.`,
    deep: `Deep ${id}.`,
    related,
    sources: [{ title: "Test", kind: "question" }],
    reviewedBy: "Test",
    reviewedAt: "2026-11-10",
  } satisfies TopicCard;
}

const fixture: Tutor = {
  ...GEOGRAPHY,
  cards: [
    card("a", "human", ["b", "c", "d", "x"]),
    card("b", "human", ["a"]),
    card("c", "physical", ["a"]),
    card("d", "physical", ["a"]),
    card("e", "human", []),
    card("x", "physical", ["a"], "draft"),
    card("y", "human", ["a"], "draft"),
  ],
};
const approvedIds = new Set(fixture.cards.filter((c) => c.status === "approved").map((c) => c.id));

describe("selectCards", () => {
  it("never returns drafts, for any seed or history", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const history of [[], [{ id: "a", at: "2026-01-01" }]]) {
        const cards = selectCards(fixture, history, { seed });
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.every((c) => approvedIds.has(c.id))).toBe(true);
      }
    }
    for (let i = 0; i < 50; i++) {
      expect(selectCards(fixture).every((c) => c.status === "approved")).toBe(true);
    }
  });

  it("works with empty history and returns up to three distinct cards", () => {
    const cards = selectCards(fixture, [], { seed: 0 });
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(selectCards(GEOGRAPHY, [])).toHaveLength(Math.min(3, GEOGRAPHY.cards.length));
  });

  it("is deterministic with a seed and rotates the first card as the seed rises", () => {
    expect(selectCards(fixture, [], { seed: 12 })).toEqual(selectCards(fixture, [], { seed: 12 }));
    const firsts = [0, 1, 2, 3, 4].map((seed) => selectCards(fixture, [], { seed })[0]?.id);
    expect(new Set(firsts).size).toBe(5);
    expect(selectCards(fixture, [], { seed: 5 })[0]?.id).toBe(firsts[0]);
  });

  it("opens on a card the student has not done", () => {
    const history = ["a", "b", "c", "d"].map((id) => ({ id, at: "2026-10-01" }));
    for (let seed = 0; seed < 10; seed++) {
      expect(selectCards(fixture, history, { seed })[0]?.id).toBe("e");
    }
  });

  it("opens on the least recently done card when all are done", () => {
    const history = [
      { id: "a", at: "2026-10-05" },
      { id: "b", at: "2026-10-01" },
      { id: "c", at: "2026-10-04" },
      { id: "d", at: "2026-10-03" },
      { id: "e", at: "2026-10-02" },
      { id: "b", at: "2026-10-06" },
    ];
    expect(selectCards(fixture, history, { seed: 3 })[0]?.id).toBe("e");
  });

  it("follows the first card's related list, preferring not done, then a different strand", () => {
    const fresh = selectCards(fixture, [{ id: "e", at: "2026-10-01" }], { seed: 0 });
    expect(fresh[0]?.id).toBe("a");
    // c and d are physical (a is human); b is the same strand.
    expect(fresh.slice(1).map((c) => c.id)).toEqual(["c", "d"]);

    const someDone = selectCards(
      fixture,
      [
        { id: "e", at: "2026-10-01" },
        { id: "c", at: "2026-10-02" },
      ],
      { seed: 0 },
    );
    expect(someDone.map((c) => c.id)).toEqual(["a", "d", "b"]);
  });

  it("filters by strand", () => {
    for (let seed = 0; seed < 10; seed++) {
      const cards = selectCards(fixture, [], { seed, strand: "physical" });
      expect(cards.map((c) => c.id).sort()).toEqual(["c", "d"]);
    }
    expect(selectCards(fixture, [], { strand: "economics" })).toEqual([]);
  });

  it("respects count and ignores an invalid seed", () => {
    expect(selectCards(fixture, [], { seed: 1, count: 1 })).toHaveLength(1);
    expect(selectCards(fixture, [], { seed: -1 }).length).toBe(3);
    expect(selectCards(fixture, [], { seed: 1.5 }).length).toBe(3);
  });
});
