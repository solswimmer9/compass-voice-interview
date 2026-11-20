// Guards where draft PPE notes can enter checked feedback: only when `includeDrafts` is true, and
// assess.server.ts sets that only from the server-verified tester flag.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groundedInput } from "@/lib/feedback/grounded.server";

const request = {
  transcript: "Prof Matt: Hello.\n\nYou: Hi.",
  ppe: true,
  cardIds: ["bag-charge"],
};

describe("draft notes in checked feedback", () => {
  it("includes a draft PPE note only when drafts are requested", () => {
    expect(groundedInput({ ...request, includeDrafts: true }).backendContext).toContain(
      "[bag-charge]",
    );
    expect(groundedInput({ ...request, includeDrafts: false }).backendContext).not.toContain(
      "[bag-charge]",
    );
  });

  it("is switched on in assess.server.ts only by the server-side tester flag", () => {
    const source = readFileSync("src/lib/assess.server.ts", "utf8");
    expect(source).toMatch(/const preview = [^\n]*isServerTester\(/);
    const uses = source.match(/includeDrafts:\s*[^,}\n]+/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses.filter((u) => !u.endsWith("boolean")))
      expect(use).toMatch(/includeDrafts:\s*(preview|includeDrafts)$/);
    expect(source).not.toMatch(/includeDrafts:\s*true/);
  });
});
