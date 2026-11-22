import { describe, expect, it } from "vitest";
import { FREE_INTERVIEWS, INTERVIEW_PACK } from "@/lib/offer";

describe("interview offer", () => {
  it("gives each customer one free interview", () => {
    expect(FREE_INTERVIEWS).toBe(2);
  });

  it("charges £20 as a one-off payment", () => {
    expect(INTERVIEW_PACK.amountMinor).toBe(2000);
    expect(INTERVIEW_PACK.currency).toBe("gbp");
    expect(INTERVIEW_PACK.displayPrice).toBe("£20");
    expect("recurringInterval" in INTERVIEW_PACK).toBe(false);
  });

  it("unlocks exactly two interviews per pack", () => {
    expect(INTERVIEW_PACK.interviews).toBe(2);
  });
});
