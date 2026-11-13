// Lint and access rules for object interviews. New object files are covered automatically.
import { describe, expect, it } from "vitest";

import { LIMITS, tutorById } from "@/content";
import {
  OBJECTS,
  objectFeedbackContext,
  objectMidwaySection,
  OBJECT_REVEAL_INSTRUCTION,
  objectForBrowser,
  objectLiveSection,
  objectOpening,
  objectsFor,
  selectObject,
  tutorsWithApprovedObjects,
  usableObjectById,
} from "@/content/objects";
import type { InterviewObject } from "@/content/types";
import { countWords } from "@/content/words";
import { TUTORS_WITH_APPROVED_OBJECTS } from "@/lib/object-interviews";
import { buildPpeSession } from "@/lib/ppe.server";

const objectFiles = import.meta.glob<{ default: InterviewObject }>(
  ["../content/objects/*.ts", "!../content/objects/index.ts", "!../content/objects/chart.ts"],
  { eager: true },
);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** Words of an object's internal title that would give the answer away if the browser saw them. */
function answerWords(object: InterviewObject) {
  return object.title
    .toLowerCase()
    .split(/[^a-z]+/u)
    .filter((word) => word.length > 3);
}

describe("object lint", () => {
  it("registers every object file in objects/index.ts, with unique ids", () => {
    const files = Object.values(objectFiles);
    expect(files.length).toBeGreaterThan(0);
    for (const module of files) expect(OBJECTS).toContain(module.default);
    const ids = OBJECTS.map((object) => object.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has one object per tutor so far, both approved by a named reviewer", () => {
    expect(OBJECTS.map((o) => [o.tutor, o.status]).sort()).toEqual([
      ["geography", "approved"],
      ["ppe", "approved"],
    ]);
    for (const object of OBJECTS) {
      expect(object.reviewedBy.trim()).not.toBe("");
      expect(object.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("offers students the approved charts", () => {
    expect(selectObject("geography")?.id).toBe("geo-chart-a");
    expect(selectObject("ppe")?.id).toBe("ppe-chart-a");
  });

  for (const object of OBJECTS) {
    describe(object.id, () => {
      it("has every required field", () => {
        expect(object.id).toMatch(SLUG);
        expect(tutorById(object.tutor), "tutor").toBeDefined();
        expect(["draft", "approved"]).toContain(object.status);
        expect(object.title.trim()).not.toBe("");
        expect(object.alt.trim()).not.toBe("");
        expect(object.notes.shows.trim()).not.toBe("");
        expect(object.notes.opening.trim()).toMatch(/\?$/u);
        expect(object.notes.probes.length).toBeGreaterThanOrEqual(3);
        expect(object.notes.probes.length).toBeLessThanOrEqual(5);
        for (const probe of object.notes.probes) expect(probe.trim()).not.toBe("");
        expect(object.notes.goodReasoning.trim()).not.toBe("");
        expect(object.sources.length).toBeGreaterThan(0);
        for (const source of object.sources) {
          expect(source.title.trim()).not.toBe("");
          expect(source.url).toMatch(/^https:\/\//u);
        }
      });

      it("is reviewed before approval, and drafts carry no reviewer", () => {
        if (object.status === "approved") {
          expect(object.reviewedBy.trim()).not.toBe("");
          expect(object.reviewedAt).toMatch(ISO_DATE);
        } else {
          expect(object.reviewedBy).toBe("");
          expect(object.reviewedAt).toBe("");
        }
      });

      it("shows the student an unlabelled, script-free SVG with years only", () => {
        expect(object.svg.startsWith("<svg ")).toBe(true);
        expect(object.svg).not.toMatch(/<script|\son[a-z]+=|href=|<foreignObject|<title/iu);
        const labels = [...object.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/gu)].map((m) => m[1]);
        expect(labels.length).toBeGreaterThan(0);
        for (const label of labels) expect(label).toMatch(/^(?:19|20)\d\d$/u);
      });

      it("never hints at the answer in anything the browser receives", () => {
        const sent = JSON.stringify(objectForBrowser(object, "Caption")).toLowerCase();
        for (const word of answerWords(object)) expect(sent, word).not.toContain(word);
        expect(sent).not.toContain(object.notes.shows.toLowerCase().slice(0, 40));
        expect(sent).not.toContain(object.notes.opening.toLowerCase());
        expect(sent).not.toContain(object.notes.goodReasoning.toLowerCase().slice(0, 40));
        for (const probe of object.notes.probes) expect(sent).not.toContain(probe.toLowerCase());
        expect(Object.keys(objectForBrowser(object, "Caption")).sort()).toEqual([
          "alt",
          "caption",
          "objectId",
          "svg",
          "type",
        ]);
      });

      it("fits the opening byte limit and names the tutor", () => {
        const opening = objectOpening(object);
        expect(new TextEncoder().encode(opening).length).toBeLessThan(LIMITS.openingBytes);
        expect(opening).toContain(tutorById(object.tutor)?.persona.name ?? "missing");
      });

      it("gives the tutor the notes and tells them not to reveal the answer", () => {
        const section = objectLiveSection(object);
        expect(section).toContain("OBJECT INTERVIEW");
        expect(section).toContain(object.notes.shows);
        for (const probe of object.notes.probes) expect(section).toContain(probe);
        expect(section).toMatch(/Never say what it shows/u);
        expect(objectFeedbackContext(object)).toContain(object.notes.goodReasoning);
      });

      it("plans a mid-interview chart with the same notes and the same rule", () => {
        const section = objectMidwaySection(object);
        expect(section).toContain("CHART LATER IN THE INTERVIEW");
        expect(section).toContain(object.notes.opening);
        expect(section).toContain(object.notes.shows);
        for (const probe of object.notes.probes) expect(section).toContain(probe);
        expect(section).toMatch(/Never say what it shows/u);
        expect(section).toMatch(/do not mention it before then/u);
      });
    });
  }

  it("keeps the reveal instruction inside the opening byte limit", () => {
    expect(new TextEncoder().encode(OBJECT_REVEAL_INSTRUCTION).length).toBeLessThan(
      LIMITS.openingBytes,
    );
    expect(OBJECT_REVEAL_INSTRUCTION).toContain("CHART LATER IN THE INTERVIEW");
  });

  it("keeps a PPE interview with a mid-interview chart inside the live word budget", async () => {
    const object = selectObject("ppe", { includeDrafts: true });
    for (let turn = 0; turn < 12; turn++) {
      const session = await buildPpeSession({ openingTurn: turn }, { includeDrafts: true });
      const live = `${session.liveInstructions}\n\n${objectMidwaySection(object!)}`;
      expect(countWords(live)).toBeLessThanOrEqual(LIMITS.liveInstructionsWords);
    }
  });

  it("keeps a PPE object interview inside the live word budget", async () => {
    const object = selectObject("ppe", { includeDrafts: true });
    expect(object).toBeDefined();
    for (let turn = 0; turn < 12; turn++) {
      const session = await buildPpeSession({ openingTurn: turn }, { includeDrafts: true });
      const live = `${session.liveInstructions}\n\n${objectLiveSection(object!)}`;
      expect(countWords(live)).toBeLessThanOrEqual(LIMITS.liveInstructionsWords);
    }
  });
});

describe("object access", () => {
  it("never gives students a draft object", () => {
    for (const tutor of ["geography", "ppe"]) {
      for (const object of objectsFor(tutor)) expect(object.status).toBe("approved");
      for (let seed = 0; seed < 10; seed++) {
        expect(selectObject(tutor, { seed })?.status ?? "approved").toBe("approved");
      }
    }
    for (const object of OBJECTS.filter((o) => o.status === "draft")) {
      expect(usableObjectById(object.id, object.tutor)).toBeUndefined();
    }
  });

  it("gives testers drafts, for the right tutor only", () => {
    expect(selectObject("geography", { includeDrafts: true })?.tutor).toBe("geography");
    expect(selectObject("ppe", { includeDrafts: true })?.tutor).toBe("ppe");
    expect(selectObject("history", { includeDrafts: true })).toBeUndefined();
    const ppeObject = selectObject("ppe", { includeDrafts: true })!;
    expect(usableObjectById(ppeObject.id, "ppe", { includeDrafts: true })).toBe(ppeObject);
    expect(usableObjectById(ppeObject.id, "geography", { includeDrafts: true })).toBeUndefined();
  });

  it("keeps the browser's list of tutors with approved objects in step with the content", () => {
    expect([...TUTORS_WITH_APPROVED_OBJECTS].sort()).toEqual(tutorsWithApprovedObjects().sort());
  });
});
