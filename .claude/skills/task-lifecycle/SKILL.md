---
name: task-lifecycle
description: Use when implementing a feature or fix in this repo end to end from a clear spec or issue - build, independent review, runtime verification and the merge gate. Not for content-only card edits (see src/content/README.md) or for designing new recurring loops (use loop-design).
---

# Task lifecycle

One task, from a clear spec to a merged change. The main session orchestrates and owns the human
gates; subagents with fresh context do the building, reviewing and verifying.

## 0. Pickup: is the input clear enough?

Size does not matter; ambiguity does. Before building, check the spec has: a goal, non-goals,
evidence (an error, a transcript, a screenshot), a way to know it is done, and **no hidden
decision**: a choice a good engineer could make two ways with different results for students,
data or money. If there is one, stop and ask; do not make the call silently.

## 1. Build

- Work on the session's branch. Commit in small steps. Never rewrite pushed history (Lovable).
- Read the nearest `AGENTS.md` nodes and `docs/glossary.md` first.
- Keep `implementation-notes.md` (not committed) for decisions where the spec was ambiguous,
  deviations, trade-offs and open questions; report them at the end.

## 2. Review (independent)

- Run `/code-review` (high effort for logic changes, lower for small ones) in a fresh context.
- For each finding, a neutral check confirms it is real before anyone fixes it.
- A **fresh** fixer applies confirmed fixes. At most 2 rounds, or stop when no medium or high
  finding remains. A change under ~30 lines with no new logic gets one light review.

## 3. Verify (runtime, not just tests)

Tests prove the code agrees with itself; verification observes it running.

1. `bunx tsc --noEmit`, `bunx vitest run`, `bun run build`: must pass (the CI checks).
2. Start the app (`bunx vite dev --host 127.0.0.1`) and drive the changed user flows with
   Playwright. A flow passes only if: the user reaches the end state, it looks right, and the stored
   state is right. Console errors and failed requests do not fail a flow alone but must be fixed or
   filed as an issue.
3. Voice calls cannot be fully verified in the sandbox (no WebRTC audio). Say so, and list the
   manual call test for the owner.
4. When unsure, it fails. Report BLOCKED, not PASS, when the environment cannot check something.

## 4. Merge gate

Read `.claude/merge-gate.md` before merging. Never edit that file without asking the owner.

## 5. After merge

Check CI on `main` passes. Report: what changed, how it was verified, what was not verified, and
any decisions for the owner. Remember `main` syncs to Lovable; the live site changes only when the
owner publishes.
