// Lint over every card of every tutor. New cards are covered automatically: the glob below finds
// every card file, and the test fails if one is not registered in its tutor's cards/index.ts.
import { describe, expect, it } from "vitest";

import { LIMITS, TUTORS } from "@/content";
import { cardOpening } from "@/content/build-session";
import type { SourceKind, TopicCard, Tutor } from "@/content/types";
import { countWords } from "@/content/words";

const cardFiles = import.meta.glob<{ default: TopicCard }>(
  ["../content/tutors/*/cards/*.ts", "!../content/tutors/*/cards/index.ts"],
  { eager: true },
);

const SOURCE_KINDS: SourceKind[] = ["paper", "book", "podcast", "video", "notes", "question"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
// Wording that would present a question as one asked in a real admissions interview.
const REAL_INTERVIEW_CLAIMS = [
  /\b(?:real|actual|genuine|past|previous|confirmed)\s+(?:\w+\s+){0,2}interview(?:s)?\b/iu,
  /\b(?:asked|used|set|posed)\s+(?:\w+\s+){0,4}(?:in|at|during)\s+(?:\w+\s+){0,3}interviews?\b/iu,
  /\binterview(?:er)?s?\s+(?:\w+\s+){0,2}(?:asked|ask|used|set)\b/iu,
  /\b(?:oxford|cambridge|oxbridge)\s+(?:\w+\s+){0,2}(?:asks?|asked)\b/iu,
];

const allCards = TUTORS.flatMap((tutor) => tutor.cards.map((card) => ({ tutor, card })));
const label = ({ tutor, card }: { tutor: Tutor; card: TopicCard }) => `${tutor.id}/${card.id}`;

function isIsoDate(value: unknown) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function surnames(tutor: Tutor, card: TopicCard) {
  const names = [
    ...card.sources.flatMap((source) => source.authors ?? []),
    ...tutor.readingList.map((entry) => entry.author),
  ];
  return [...new Set(names.map((name) => name.trim().split(/\s+/u).at(-1) ?? ""))].filter(
    (name) => name.length > 1,
  );
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

describe("card lint", () => {
  it("has at least one approved card per tutor", () => {
    for (const tutor of TUTORS) {
      expect(
        tutor.cards.some((card) => card.status === "approved"),
        tutor.id,
      ).toBe(true);
    }
  });

  it("registers every card file in its tutor's cards/index.ts", () => {
    const files = Object.entries(cardFiles);
    expect(files.length).toBeGreaterThan(0);
    for (const [path, module] of files) {
      const match = /tutors\/([^/]+)\/cards\/([^/]+)\.ts$/u.exec(path);
      const [, tutorId, fileId] = match ?? [];
      const tutor = TUTORS.find((t) => t.id === tutorId);
      expect(tutor, `${path}: tutor folder not in TUTORS`).toBeDefined();
      expect(module.default, `${path}: needs a default export`).toBeDefined();
      expect(module.default.id, `${path}: file name must equal the card id`).toBe(fileId);
      expect(module.default.tutor, path).toBe(tutorId);
      expect(tutor?.cards.includes(module.default), `${path}: not imported in cards/index.ts`).toBe(
        true,
      );
    }
  });

  it("has unique card ids across all tutors", () => {
    const ids = allCards.map(({ card }) => card.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it.each(allCards.map((entry) => [label(entry), entry] as const))(
    "%s has valid required fields",
    (_, { tutor, card }) => {
      expect(card.id).toMatch(SLUG);
      expect(card.tutor).toBe(tutor.id);
      expect(tutor.strands).toContain(card.strand);
      expect(["draft", "approved"]).toContain(card.status);
      expect(Array.isArray(card.tags) && card.tags.length > 0).toBe(true);
      for (const tag of card.tags) expect(tag).toMatch(SLUG);
      expect(card.opening.trim()).toMatch(/\?$/u);
      expect(card.live.trim().length).toBeGreaterThan(0);
      expect(card.deep.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(card.related)).toBe(true);
      expect(card.sources.length).toBeGreaterThan(0);
      for (const source of card.sources) {
        expect(source.title.trim().length).toBeGreaterThan(0);
        expect(SOURCE_KINDS).toContain(source.kind);
        if (source.url !== undefined) expect(source.url).toMatch(/^https:\/\//u);
      }
      if (card.status === "approved") {
        expect(
          card.reviewedBy.trim().length,
          "approved cards need a named reviewer",
        ).toBeGreaterThan(0);
      }
      if (card.status === "approved" || card.reviewedAt) {
        expect(isIsoDate(card.reviewedAt), `reviewedAt ${card.reviewedAt}`).toBe(true);
      }
      if (card.recheckBy !== undefined) {
        expect(isIsoDate(card.recheckBy), `recheckBy ${card.recheckBy}`).toBe(true);
        expect(card.recheckBy > card.reviewedAt).toBe(true);
      }
    },
  );

  it.each(allCards.map((entry) => [label(entry), entry] as const))(
    "%s respects the word limits and the opening byte limit",
    (_, { tutor, card }) => {
      expect(countWords(card.live)).toBeLessThanOrEqual(LIMITS.cardLiveWords);
      expect(countWords(card.deep)).toBeLessThanOrEqual(LIMITS.cardDeepWords);
      expect(new TextEncoder().encode(cardOpening(tutor, card)).length).toBeLessThan(
        LIMITS.openingBytes,
      );
    },
  );

  it.each(allCards.map((entry) => [label(entry), entry] as const))(
    "%s names no source author in what the voice model hears",
    (_, { tutor, card }) => {
      const spoken = `${card.opening}\n${card.live}`;
      for (const surname of surnames(tutor, card)) {
        expect(spoken, `"${surname}" must stay in deep`).not.toMatch(
          new RegExp(`(?<![\\p{L}-])${escape(surname)}(?![\\p{L}-])`, "iu"),
        );
      }
    },
  );

  it.each(allCards.map((entry) => [label(entry), entry] as const))(
    "%s never claims a question was asked in a real interview",
    (_, { card }) => {
      for (const text of [
        card.opening,
        card.live,
        card.deep,
        ...card.sources.map((s) => s.title),
      ]) {
        for (const pattern of REAL_INTERVIEW_CLAIMS) expect(text).not.toMatch(pattern);
      }
    },
  );

  it.each(allCards.map((entry) => [label(entry), entry] as const))(
    "%s has related ids that exist for the same tutor",
    (_, { tutor, card }) => {
      const ids = new Set(tutor.cards.map((c) => c.id));
      for (const id of card.related) {
        expect(id).not.toBe(card.id);
        expect(ids.has(id), `related "${id}" does not exist`).toBe(true);
      }
      expect(new Set(card.related).size).toBe(card.related.length);
    },
  );

  it("does not let the persona name a reading-list author in the live prompt", () => {
    for (const tutor of TUTORS) {
      const spoken = [tutor.persona.identity, tutor.persona.lookingFor, tutor.persona.habits].join(
        "\n",
      );
      for (const entry of tutor.readingList) {
        const surname = entry.author.split(/\s+/u).at(-1) ?? "";
        expect(spoken).not.toMatch(new RegExp(`\\b${escape(surname)}\\b`, "iu"));
      }
    }
  });
});
