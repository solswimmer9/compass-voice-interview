// PreToolUse hook for Bash: hard stops for the "never do X" rules in AGENTS.md and .claude/merge-gate.md.
// shortcut: matches command text, so a determined script can get round it; it stops the honest mistakes.
let input = "";
for await (const chunk of process.stdin) input += chunk;
const cmd = String(JSON.parse(input || "{}").tool_input?.command ?? "");

const rules = [
  [
    /\bgit\s+push\b[^;&|]*\s(--force\b|--force-with-lease\b|-f\b|\+)/,
    "force-pushing rewrites history that Lovable syncs",
  ],
  [
    /\bgit\s+push\b[^;&|]*\s(origin\s+)?(\S+:)?(refs\/heads\/)?main\b/,
    "main syncs straight to Lovable; push your branch and open a PR",
  ],
  [
    /\bsupabase\s+(db\s+(push|reset)|migration\s+(up|repair|squash)|link)\b/,
    "Lovable manages the database; ask Lovable to change it",
  ],
  [
    /\b(drizzle-kit\s+(push|migrate|drop)|bunx?\s+drizzle-kit\s+(push|migrate|drop))\b/,
    "Lovable manages the database; ask Lovable to change it",
  ],
  [
    /(\bsed\s+-i|>>?|\btee\b|\brm\b|\bmv\b|\bcp\b)[^;&|]*\b(supabase|drizzle)\//,
    "supabase/ and drizzle/ are managed by Lovable",
  ],
];

for (const [re, why] of rules) {
  if (re.test(cmd)) {
    console.error(
      `Blocked: ${why} (see AGENTS.md). If the owner explicitly asked for this, tell them it needs doing by hand.`,
    );
    process.exit(2);
  }
}
