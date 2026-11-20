import { describe, expect, it } from "vitest";
import { DR_RIVER_BRIEFING } from "@/lib/interview-briefing";
import { GEOGRAPHY_PERSONA } from "@/content/tutors/geography/persona";
import { GEOGRAPHY_ASSUMPTION_TESTING } from "@/content/tutors/geography/assumptions";

// Solomon, 19 November 2026: Dr River should be sharper and test assumptions implicit in answers.
describe("Dr River tests hidden assumptions", () => {
  it("gives students the assumption-testing rules", () => {
    expect(DR_RIVER_BRIEFING).toContain(GEOGRAPHY_ASSUMPTION_TESTING);
  });

  it("gives tester card sessions the same rules", () => {
    expect(GEOGRAPHY_PERSONA.habits).toContain(GEOGRAPHY_ASSUMPTION_TESTING);
  });

  it("tells him to name the assumption back and bring drifting answers back to the question", () => {
    expect(GEOGRAPHY_ASSUMPTION_TESTING).toContain("Say the assumption back plainly");
    expect(GEOGRAPHY_ASSUMPTION_TESTING).toContain("bring them back to it");
  });
});
