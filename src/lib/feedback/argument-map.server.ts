// The argument map for the evidence-checked feedback path. Server-only.
//
// On the single-call path the model writes the letter and then the map in one reply. The checked
// path writes the letter in several calls and never produces a map, so this asks for the map on
// its own and appends it in the exact form the panel already reads. Anything malformed gives no
// map, which the panel already handles (the letter shows without one).
import {
  ARGUMENT_MAP_DELIMITER,
  ARGUMENT_MAP_INSTRUCTIONS,
  parseArgumentMap,
} from "./argument-map";

/** The single-call map rules, minus the lines about the letter, so the two cannot drift. */
const MAP_RULES = ARGUMENT_MAP_INSTRUCTIONS.split("\n")
  .slice(1)
  .filter((line) => !line.includes("in the feedback itself"))
  .join("\n");

export const ARGUMENT_MAP_ONLY_SYSTEM = `You read the transcript of a practice admissions interview and map the candidate's argument. Write no feedback. Reply with ${ARGUMENT_MAP_DELIMITER} on its own line, then one line of compact JSON and nothing else:
${MAP_RULES}`;

export type MapTextModel = (args: { system: string; prompt: string }) => Promise<string>;

/**
 * Returns the map block to append after the checked letter (delimiter plus validated JSON), or
 * "" when the model gives nothing usable, fails or runs out of time. Never throws.
 */
export async function buildArgumentMapBlock(
  transcript: string,
  generate: MapTextModel,
  timeoutMs: number,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const reply = await Promise.race([
      generate({
        system: ARGUMENT_MAP_ONLY_SYSTEM,
        prompt: `Interview transcript:\n\n${transcript}`,
      }),
      timeout,
    ]);
    if (reply === null) return "";
    const at = reply.indexOf(ARGUMENT_MAP_DELIMITER);
    const map = parseArgumentMap(
      at === -1 ? reply : reply.slice(at + ARGUMENT_MAP_DELIMITER.length),
    );
    return map ? `\n\n${ARGUMENT_MAP_DELIMITER}\n${JSON.stringify(map)}` : "";
  } catch {
    return "";
  } finally {
    if (timer) clearTimeout(timer);
  }
}
