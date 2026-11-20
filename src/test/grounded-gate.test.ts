// Guards the tester-only gate around grounded feedback: groundedInput includes draft PPE notes
// (so it is tester-only), and the only caller in handleAssess is behind the server-side tester flag.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groundedInput } from "@/lib/feedback/grounded.server";
import { ppeFeedbackContext } from "@/lib/ppe.server";

describe("grounded feedback gate", () => {
  it("includes draft PPE notes, which is why it is tester-only", () => {
    const input = groundedInput({
      transcript: "Prof Matt: Hello.\n\nYou: Hi.",
      ppe: true,
      cardIds: ["bag-charge"],
    });
    expect(input.backendContext).toContain("[bag-charge]");
    // Students' own feedback context never carries that draft note.
    expect(ppeFeedbackContext(["bag-charge"])).not.toContain("[bag-charge]");
  });

  it("is reached in assess.server.ts only when the server-side tester flag is true", () => {
    const source = readFileSync("src/lib/assess.server.ts", "utf8");
    const calls = source.match(/runTesterFeedback\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(source).toMatch(/if \(preview && canUseGroundedFeedback\(/);
    expect(source).toMatch(/const preview = [^\n]*isServerTester\(/);
  });
});
