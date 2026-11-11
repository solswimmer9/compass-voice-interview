import { describe, expect, it } from "vitest";

import { cardsFor, TUTORS, tutorById, type Tutor } from "@/content";
import {
  buildFeedbackContext,
  feedbackCards,
  interviewerSubject,
} from "@/content/feedback-context";

const geography = tutorById("geography") as Tutor;
const ppe = tutorById("ppe") as Tutor;
const approved = cardsFor("geography");
const drafts = geography.cards.filter((card) => card.status === "draft");

describe("buildFeedbackContext", () => {
  it("uses only the named approved cards when given valid card ids", () => {
    const [a, b, other] = approved;
    const context = buildFeedbackContext(geography, [a!.id, b!.id]);
    expect(context).toContain(geography.reasoningGuide);
    expect(context).toContain(a!.deep);
    expect(context).toContain(b!.deep);
    expect(context).not.toContain(other!.deep);
    expect(context).toContain("TOPIC NOTES FOR THIS INTERVIEW");
  });

  it("covers every approved card when no card ids are given", () => {
    const context = buildFeedbackContext(geography);
    expect(context).toContain(geography.reasoningGuide);
    for (const card of approved) expect(context).toContain(card.deep);
    for (const entry of geography.readingList) expect(context).toContain(entry.author);
  });

  it("ignores drafts, other tutors' cards, unknown ids and non-arrays", () => {
    expect(drafts.length).toBeGreaterThan(0);
    expect(feedbackCards(geography, [drafts[0]!.id, "made-up", 42])).toEqual([]);
    expect(feedbackCards(geography, "river-person")).toEqual([]);
    const context = buildFeedbackContext(geography, [drafts[0]!.id]);
    expect(context).not.toContain(drafts[0]!.deep);
    for (const card of approved) expect(context).toContain(card.deep);
  });

  it("de-duplicates card ids and keeps their order", () => {
    const [a, b] = approved;
    expect(feedbackCards(geography, [b!.id, a!.id, b!.id]).map((c) => c.id)).toEqual([
      b!.id,
      a!.id,
    ]);
  });

  it("works for a tutor with no cards", () => {
    const context = buildFeedbackContext(ppe);
    expect(context).toContain(ppe.reasoningGuide);
    expect(context).not.toContain("TOPIC NOTES");
  });

  it("describes each tutor's interviewer by subject", () => {
    expect(interviewerSubject(geography)).toBe("Cambridge geography");
    expect(interviewerSubject(ppe)).toBe("Oxford-style PPE");
    for (const tutor of TUTORS) expect(interviewerSubject(tutor)).toBeTruthy();
  });
});
