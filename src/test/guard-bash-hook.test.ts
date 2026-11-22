import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (command: string) =>
  spawnSync("node", [".claude/hooks/guard-bash.mjs"], {
    input: JSON.stringify({ tool_input: { command } }),
  }).status;

describe("guard-bash hook", () => {
  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push --force origin my-branch",
    "git push -f",
    "supabase db push",
    "sed -i s/a/b/ supabase/config.toml",
    "echo x > drizzle/schema.ts",
  ])("blocks %s", (cmd) => expect(run(cmd)).toBe(2));

  it.each([
    "git push -u origin claude/some-branch",
    "git push origin maintenance",
    "cat supabase/config.toml",
    "bunx vitest run",
  ])("allows %s", (cmd) => expect(run(cmd)).toBe(0));
});
