import { describe, expect, it } from "vitest";
import { isPreviewHostname } from "@/lib/preview";

describe("preview testing host checks", () => {
  it("allows the current preview and localhost", () => {
    expect(isPreviewHostname("id-preview--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(
      true,
    );
    expect(isPreviewHostname("localhost")).toBe(true);
  });

  it("allows numbered drafts, commit previews, and stable development previews", () => {
    expect(
      isPreviewHostname("id-preview-6--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app"),
    ).toBe(true);
    expect(
      isPreviewHostname("id-preview-abc123--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app"),
    ).toBe(true);
    expect(isPreviewHostname("project--6db3f9e0-08e4-5430-979a-8856445f33a9-dev.lovable.app")).toBe(
      true,
    );
  });

  it("keeps the published site and misleading hosts on normal limits", () => {
    expect(isPreviewHostname("compass-voice-interview.lovable.app")).toBe(false);
    expect(isPreviewHostname("project--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(
      false,
    );
    expect(isPreviewHostname("id-preview--anything.example.com")).toBe(false);
    expect(isPreviewHostname("id-preview--anything.lovable.app.evil.example")).toBe(false);
  });
});

describe("tester allow-list", () => {
  it("only lets listed emails use unlimited testing", async () => {
    const { isTesterEmail } = await import("@/lib/testers");
    const list = " Owner@Example.com , second@example.com ";
    expect(isTesterEmail("owner@example.com", list)).toBe(true);
    expect(isTesterEmail("SECOND@example.com", list)).toBe(true);
    expect(isTesterEmail("someone@example.com", list)).toBe(false);
    expect(isTesterEmail(undefined, list)).toBe(false);
  });

  it("gives nobody unlimited testing when the list is not set", async () => {
    const { isTesterEmail } = await import("@/lib/testers");
    expect(isTesterEmail("owner@example.com", undefined)).toBe(false);
    expect(isTesterEmail("owner@example.com", "")).toBe(false);
  });
});
