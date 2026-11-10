import { describe, expect, it } from "vitest";

import { cardsFor, LIMITS, TUTORS } from "@/content";
import { buildSession } from "@/content/build-session";
import { CORE_RULES, PEDAGOGY_VERSION, VOICE_POLICY } from "@/content/core";
import { renderMemory } from "@/content/memory";
import { GEOGRAPHY } from "@/content/tutors/geography";
import type { StudentMemory, TopicCard, Tutor } from "@/content/types";
import { countWords } from "@/content/words";
import { openingInstructions, readingOpeningInstructions } from "@/lib/interview-briefing";
import { READINGS } from "@/lib/readings";

const bytes = (text: string) => new TextEncoder().encode(text).length;
const geographyCards = cardsFor("geography");

const longItem = "word ".repeat(60).trim();
const hugeMemory: StudentMemory = {
  interviews: 41,
  cardsDone: TUTORS.flatMap((t) =>
    t.cards.map((c, i) => ({ id: c.id, at: `2026-0${(i % 9) + 1}-01` })),
  ),
  strengths: [longItem, longItem, longItem, longItem],
  habits: [longItem, longItem, longItem, longItem],
  nextFocus: longItem,
};

function authorNames(tutor: Tutor, cards: readonly TopicCard[]) {
  const names = [
    ...cards.flatMap((c) => c.sources.flatMap((s) => s.authors ?? [])),
    ...tutor.readingList.map((entry) => entry.author),
  ];
  return [...new Set(names.map((name) => name.split(/\s+/u).at(-1) ?? name))];
}

function sentences(text: string) {
  return text
    .split(/(?<=[.?!])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 6);
}

function combinations<T>(items: readonly T[], max: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length) out.push([...current]);
    if (current.length === max) return;
    for (let i = start; i < items.length; i++) walk(i + 1, [...current, items[i] as T]);
  };
  walk(0, []);
  return out;
}

describe("buildSession", () => {
  it("puts persona, core rules, card live text and voice policy into liveInstructions", async () => {
    const cards = geographyCards.slice(0, 3);
    const session = await buildSession({ tutor: GEOGRAPHY, cards });
    expect(session.liveInstructions).toContain(GEOGRAPHY.persona.identity);
    expect(session.liveInstructions).toContain(GEOGRAPHY.persona.lookingFor);
    expect(session.liveInstructions).toContain(CORE_RULES);
    expect(session.liveInstructions).toContain(VOICE_POLICY);
    expect(session.liveInstructions).toContain(GEOGRAPHY.persona.voice);
    expect(session.liveInstructions.endsWith(VOICE_POLICY)).toBe(true);
    for (const card of cards) {
      expect(session.liveInstructions).toContain(card.live);
      expect(session.liveInstructions).toContain(card.opening);
    }
    expect(session.cardIds).toEqual(cards.map((c) => c.id));
    expect(session.tutorId).toBe("geography");
    expect(session.pedagogyVersion).toBe(PEDAGOGY_VERSION);
    expect(session.readingId).toBeUndefined();
  });

  it("keeps deep text and author names out of liveInstructions but in backendContext", async () => {
    const session = await buildSession({ tutor: GEOGRAPHY, cards: geographyCards.slice(0, 3) });
    for (const tutor of TUTORS) {
      for (const card of tutor.cards) {
        for (const sentence of sentences(card.deep)) {
          expect(session.liveInstructions).not.toContain(sentence);
        }
      }
      for (const surname of authorNames(tutor, tutor.cards)) {
        expect(session.liveInstructions).not.toMatch(new RegExp(`\\b${surname}\\b`, "iu"));
      }
    }
    for (const card of geographyCards.slice(0, 3)) {
      expect(session.backendContext).toContain(card.deep);
    }
    expect(session.backendContext).toContain(GEOGRAPHY.reasoningGuide);
    expect(session.backendContext).toContain("Rebecca Solnit, Hope in the Dark");
  });

  it("matches today's opening instruction wording", async () => {
    const card = geographyCards.find((c) => c.id === "river-person") as TopicCard;
    const session = await buildSession({ tutor: GEOGRAPHY, cards: [card] });
    const index = 2; // "Can a river be a person?" in OPENING_QUESTIONS
    expect(session.opening).toBe(openingInstructions(index));

    const reading = READINGS[0]!;
    const readingSession = await buildSession({ tutor: GEOGRAPHY, cards: [card], reading });
    expect(readingSession.opening).toBe(readingOpeningInstructions(reading));
  });

  it("includes only the chosen reading in a reading interview", async () => {
    const [reading, other] = READINGS;
    const session = await buildSession({ tutor: GEOGRAPHY, cards: [], reading: reading! });
    expect(session.liveInstructions).toContain(reading!.context);
    for (const q of reading!.questions) expect(session.liveInstructions).toContain(q);
    for (const t of reading!.tutorThoughts) expect(session.liveInstructions).toContain(t);
    expect(session.liveInstructions).not.toContain(other!.context);
    expect(session.readingId).toBe(reading!.id);
    expect(session.cardIds).toEqual([]);
  });

  it("produces a stable SHA-256 hash of liveInstructions", async () => {
    const a = await buildSession({ tutor: GEOGRAPHY, cards: geographyCards.slice(0, 2) });
    const b = await buildSession({ tutor: GEOGRAPHY, cards: geographyCards.slice(0, 2) });
    const c = await buildSession({ tutor: GEOGRAPHY, cards: geographyCards.slice(0, 1) });
    expect(a.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.promptHash).not.toBe(c.promptHash);
  });

  it("refuses drafts, other tutors' cards and an empty interview", async () => {
    const first = geographyCards[0]!;
    await expect(
      buildSession({ tutor: GEOGRAPHY, cards: [{ ...first, status: "draft" }] }),
    ).rejects.toThrow(/not approved/);
    await expect(
      buildSession({ tutor: GEOGRAPHY, cards: [{ ...first, tutor: "ppe" }] }),
    ).rejects.toThrow(/another tutor/);
    await expect(buildSession({ tutor: GEOGRAPHY, cards: [] })).rejects.toThrow();
  });

  it("keeps every card's opening under the 480-byte greeting limit", async () => {
    for (const tutor of TUTORS) {
      for (const card of cardsFor(tutor.id)) {
        const session = await buildSession({ tutor, cards: [card] });
        expect(bytes(session.opening), card.id).toBeLessThan(LIMITS.openingBytes);
      }
      for (const reading of READINGS) {
        const session = await buildSession({ tutor, cards: [], reading });
        expect(bytes(session.opening), reading.id).toBeLessThan(LIMITS.openingBytes);
      }
    }
  });

  it("keeps liveInstructions within 2,000 words for every combination of up to 3 cards", async () => {
    for (const tutor of TUTORS) {
      const cards = cardsFor(tutor.id);
      // Exhaustive while that stays cheap; beyond it, the three longest cards are the worst case,
      // because each card adds its own words independently of the others.
      const combos =
        cards.length <= 20
          ? combinations(cards, 3)
          : [
              [...cards]
                .sort(
                  (a, b) =>
                    countWords(b.opening + " " + b.live) - countWords(a.opening + " " + a.live),
                )
                .slice(0, 3),
            ];
      for (const combo of combos) {
        for (const reading of [null, ...READINGS]) {
          const { liveInstructions } = await buildSession({
            tutor,
            cards: combo,
            memory: hugeMemory,
            reading,
          });
          expect(
            countWords(liveInstructions),
            combo.map((c) => c.id).join(","),
          ).toBeLessThanOrEqual(LIMITS.liveInstructionsWords);
        }
      }
    }
  });
});

describe("renderMemory", () => {
  it("renders nothing for a first-time student", () => {
    expect(renderMemory(null)).toBe("");
    expect(
      renderMemory({ interviews: 0, cardsDone: [], strengths: [], habits: [], nextFocus: "" }),
    ).toBe("");
  });

  it("summarises a returning student without saying it remembers them", () => {
    const text = renderMemory({
      interviews: 2,
      cardsDone: [
        { id: "river-person", at: "2026-10-01" },
        { id: "regeneration-who-for", at: "2026-10-08" },
      ],
      strengths: ["Uses examples from their own town"],
      habits: ["Concedes as soon as challenged"],
      nextFocus: "Hold a position for two more turns.",
    });
    expect(text).toContain("Third interview");
    expect(text).toContain("Concedes as soon as challenged");
    expect(text).toContain("Can a river be a person");
    expect(text).toContain("Do not mention that you have notes on them unless they ask.");
    expect(countWords(text)).toBeLessThanOrEqual(LIMITS.memoryLiveWords);
  });

  it("never exceeds 80 words, however large or malformed the memory", () => {
    expect(countWords(renderMemory(hugeMemory))).toBeLessThanOrEqual(LIMITS.memoryLiveWords);
    const malformed = {
      interviews: -3,
      cardsDone: [{ id: "unknown", at: "not a date" }],
      strengths: [longItem.repeat(5)],
      habits: "not a list",
      nextFocus: `line one\nline two ${longItem.repeat(3)}`,
    } as unknown as StudentMemory;
    const text = renderMemory(malformed);
    expect(countWords(text)).toBeLessThanOrEqual(LIMITS.memoryLiveWords);
    expect(text).not.toContain("\n");
    for (let n = 0; n < 20; n++) {
      const memory: StudentMemory = {
        interviews: n,
        cardsDone: [],
        strengths: Array.from({ length: n }, () => "word ".repeat(n * 3)),
        habits: Array.from({ length: n }, () => "word ".repeat(n * 2)),
        nextFocus: "word ".repeat(n * 4),
      };
      expect(countWords(renderMemory(memory))).toBeLessThanOrEqual(LIMITS.memoryLiveWords);
    }
  });
});
