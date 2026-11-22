# How we should use context and loops

Distilled from the Agentic Coding School course (The Software Factory Engineer, cohort 3: Context
Engineering and the loop chapters), applied to this repo. The working versions are three skills:

- `.claude/skills/context-layer/`: where each kind of fact lives, and how to keep it lean.
- `.claude/skills/loop-design/`: spotting loop-shaped work and building loops that stop.
- `.claude/skills/task-lifecycle/`: one task from spec to merge, with `.claude/merge-gate.md`.
- `.claude/skills/context-layer-architect/`: the course's own audit skill, unchanged. Run
  `/context-layer-architect` to audit and rebuild the layer (items 1–6 below).

`task-lifecycle` is the course's own skill and references, with a short section on this repo's
differences.

## The two ideas

1. **Context beats prompts.** Once the plan is good, the code is good; plans go wrong because a fact
   was missing (a rule only Solomon knows, a Lovable constraint, a decision made in an old chat).
   Store those facts once, next to the code, in as few words as possible, and let agents load them
   only when they reach that area.
2. **Prompt loops, not agents.** Every task you repeat should become a loop with a trigger, a unit of
   work, an independent check, an exit and somewhere to keep state. Your job shifts from doing the
   work to deciding which loops exist and how good "done" must be.

## What to change in this repo, in order

| #   | Change                                                                                                                                                                                                                 | Why                                                                                                                                          | Effort     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Done.** Add a one-line `CLAUDE.md` that imports `AGENTS.md` (`@AGENTS.md`)                                                                                                                                           | Claude Code reads `CLAUDE.md`; Lovable and Codex read `AGENTS.md`. One source, both tools                                                    | 1 minute   |
| 2   | **Done.** Cut `README.md` to setup commands only                                                                                                                                                                       | It still holds the first Lovable prompt ("could you build me a minal mvp…") and generic text; stale docs are a second, wrong source of truth | 5 minutes  |
| 3   | **Done.** Move `docs/overnight-*.md` and finished plans to `docs/archive/`                                                                                                                                             | Old plans read as current instructions                                                                                                       | 5 minutes  |
| 4   | Turn `src/content/README.md` into `src/content/AGENTS.md`; add `src/lib/AGENTS.md` holding the credit and tester rules now in the root                                                                                 | Rules load when an agent reaches that code, and the root stays a pointer                                                                     | 30 minutes |
| 5   | Start `docs/decisions/` with three ADRs already made: tester access by email, never hostname; geography keeps the fixed prompt; students hear approved cards only                                                      | Stops future agents reopening settled choices                                                                                                | 30 minutes |
| 6   | Add `docs/architecture/access.md`: the invariant "only signed-in students with a credit start an interview; only testers skip credits" across page, relay, feedback, webhook and database, with the test guarding each | One table an agent checks before touching money or access                                                                                    | 1 hour     |
| 7   | **Done.** Add a hook that blocks edits to `supabase/migrations/` and `drizzle/`                                                                                                                                        | A hard rule belongs in a hook, not in prose an agent may skim                                                                                | 15 minutes |
| 8   | Use `docs/glossary.md` in prompts and append to it                                                                                                                                                                     | Agents follow instructions better in the codebase's own words                                                                                | Ongoing    |

## Loops to set up first

1. **CI watcher on `main`:** a Lovable or agent push turns CI red → reproduce, fix, push, stop when
   green.
2. **Card drafting (builder/verifier):** owner notes → draft card → content tests → neutral
   reviewer (no real-interview claims, no names in what the tutor hears, no invented references) →
   fix, at most 3 rounds. Only the owner approves.
3. **PR babysitter:** `/loop` every 10 minutes on an open PR until 10 quiet minutes with no medium or
   high comment.
4. **Card freshness (monthly scheduled task):** open an issue for each card past `recheckBy`,
   especially current-affairs PPE cards.
5. **Feedback quality (later):** once transcripts are stored, sample interviews with the evaluation
   kit in `src/lib/evals/` and file issues for weak tutor habits.

## Habits

- One chat per task; start fresh when the task changes.
- Add a rule only after an agent repeats a mistake, in the node nearest the code; prune after
  refactors and new models.
- The builder never grades itself; reviewers and verifiers are fresh agents, fixes go back to the
  builder; stop after 2–3 rounds or when no medium or high issue remains.
- Verification means watching it run (browser, real call), not only green tests. Voice calls still
  need a human test until the sandbox can play audio.
- Ask for an `implementation-notes.md` on any task with an ambiguous spec, and read it.
- Money, access, legal pages, Lovable-managed files and content approval always wait for you
  (`.claude/merge-gate.md`).
