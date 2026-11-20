import { it } from "vitest";
import { buildPpeSession } from "@/lib/ppe.server";
import { selectObject, objectLiveSection, objectMidwaySection } from "@/content/objects";
import { countWords } from "@/content/words";
import { VOICE_POLICY } from "@/content/core";
it("wc", async () => {
  const o = selectObject("ppe", { includeDrafts: true })!;
  let a = 0, b = 0;
  for (let t = 0; t < 12; t++) {
    const s = await buildPpeSession({ openingTurn: t }, { includeDrafts: true });
    a = Math.max(a, countWords(`${s.liveInstructions}\n\n${objectMidwaySection(o)}`));
    b = Math.max(b, countWords(`${s.liveInstructions}\n\n${objectLiveSection(o)}`));
  }
  console.log("MAX", a, b, "policy", countWords(VOICE_POLICY));
});
