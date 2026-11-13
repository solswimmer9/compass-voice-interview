import { describe, expect, it } from "vitest";
import { SCHOOL_BUNDLE, offerForPriceId } from "@/lib/offer";
describe("school bundle offer", () => {
  it("costs £1,250 GBP", () => {
    expect(SCHOOL_BUNDLE.amountMinor).toBe(125000);
    expect(SCHOOL_BUNDLE.currency).toBe("gbp");
  });
  it("contains 30 shared interviews", () => {
    expect(SCHOOL_BUNDLE.interviews).toBe(30);
  });
  it("allows up to 30 students", () => {
    expect(SCHOOL_BUNDLE.maxStudents).toBe(30);
  });
  it("resolves the school checkout price", () => {
    expect(offerForPriceId("school_bundle_30_gbp")).toBe(SCHOOL_BUNDLE);
  });
});
