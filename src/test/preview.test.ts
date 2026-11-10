import { describe, expect, it } from "vitest";
import { isPreviewHostname } from "@/lib/preview";

describe("preview testing host checks", () => {
  it("allows the current preview and localhost", () => {
    expect(isPreviewHostname("id-preview--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(true);
    expect(isPreviewHostname("localhost")).toBe(true);
  });

  it("allows numbered drafts, commit previews, and stable development previews", () => {
    expect(isPreviewHostname("id-preview-6--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(true);
    expect(isPreviewHostname("id-preview-abc123--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(true);
    expect(isPreviewHostname("project--6db3f9e0-08e4-5430-979a-8856445f33a9-dev.lovable.app")).toBe(true);
  });

  it("allows the current live-preview host without opening the published site", () => {
    expect(isPreviewHostname("6db3f9e0-08e4-5430-979a-8856445f33a9.lovableproject.com")).toBe(true);
    expect(isPreviewHostname("live--6db3f9e0-08e4-5430-979a-8856445f33a9.lovableproject-dev.com")).toBe(true);
    expect(isPreviewHostname("6db3f9e0-08e4-5430-979a-8856445f33a9.lovableproject.com.evil.example")).toBe(false);
    expect(isPreviewHostname("compass-voice-interview.lovable.app")).toBe(false);
  });

  it("keeps the published site and misleading hosts on normal limits", () => {
    expect(isPreviewHostname("compass-voice-interview.lovable.app")).toBe(false);
    expect(isPreviewHostname("project--6db3f9e0-08e4-5430-979a-8856445f33a9.lovable.app")).toBe(false);
    expect(isPreviewHostname("id-preview--anything.example.com")).toBe(false);
    expect(isPreviewHostname("id-preview--anything.lovable.app.evil.example")).toBe(false);
  });
});
