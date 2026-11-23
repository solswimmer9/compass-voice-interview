// PreToolUse hook: Lovable owns the database files, so agents must ask Lovable instead (AGENTS.md).
import { relative, resolve } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { tool_input = {}, cwd = process.cwd() } = JSON.parse(input || "{}");
const file = tool_input.file_path ?? tool_input.notebook_path;
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
const rel = relative(root, resolve(cwd, file)).replaceAll("\\", "/");
if (/^(supabase|drizzle)\//i.test(rel)) {
  console.error(
    `Blocked: ${rel} is managed by Lovable. Ask Lovable to change the database instead (see AGENTS.md).`,
  );
  process.exit(2);
}
