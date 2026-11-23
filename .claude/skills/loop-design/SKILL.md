---
name: loop-design
description: Use when turning repeated work into a loop (a recurring check, a builder/verifier cycle, a worker that clears a queue, a scheduled report), when choosing between /loop, Monitor, headless mode, scheduled tasks, /goal or a workflow, or when an existing loop runs forever, stops early or keeps producing the same output. Not for running one feature end to end (use task-lifecycle).
---

# Designing loops

Prompt loops, not agents. A loop is a prompt that keeps running until a check says the work is
done, so you maintain the loops and the loops maintain the software. Build one only after doing the
work by hand a few times: that is how you learn what "good" looks like to teach the check.

## Spot loop-shaped work

- **You are the message bus:** copying output from one tool or agent into another (review comments
  into a fix session, a Lovable error into Claude). Strongest sign.
- **After-done rituals:** the same steps every time a task finishes (run tests, start the dev
  server, click through, push, update the roadmap).
- **Watch and react:** something you check every day and respond to (CI on `main`, Stripe events,
  feedback complaints). Use read-only access where possible.

## Five parts every loop needs

| Part | Question | Examples here |
|---|---|---|
| Trigger | What starts a run? | A schedule, an event (new issue, PR comment, CI failure), or you |
| Unit of work | What does one run do? | Fix one failing check; draft one card; answer one review comment |
| Check | How do we know it worked? | Tests, lint, a scored audit, a browser run, a reviewer subagent |
| Exit | When does it stop? | Check passed, N rounds, a time or token budget |
| State | Where does it remember? | GitHub issues and labels, a file in the repo, a PR thread |

Without state, a loop repeats itself; give it somewhere to read and write every run.

## Levels

| Level | What | Here |
|---|---|---|
| L1 | One agent turn | A normal session |
| L2 | Builder/verifier: build, check, fix until the check passes | Draft a card, run `content-*` tests, fix |
| L3 | Whole task lifecycle: spec → build → review → verify → ship | `task-lifecycle` skill |
| L4 | Worker: takes items from a queue and runs L3 on each | Open GitHub issues labelled `ready` |
| L5 | Discovery: decides what becomes work | Scan feedback, transcripts and errors into issues |
| L6+ | Watching loops, and you deciding which should exist | Kill a loop that has run for weeks without helping |

Move up only when the level below is reliable.

## Pick the tool

| Need | Tool |
|---|---|
| Repeat a prompt every N minutes while a session is open | `/loop` |
| React to an event without paying for polling (logs, CI, new comments) | Monitor |
| Batch or scripted runs | `claude -p` (headless) with `--output-format json`, `--allowedTools`, `--max-turns` |
| Run on a schedule with the session closed | Scheduled task (always press "run now" once to test) |
| Keep going until a stated outcome is really met | `/goal` with a concrete check |
| Many subagents passing results in code, with budgets | A workflow |

## Builder and verifier

- The builder never grades its own work. A separate verifier with a fresh context checks against
  something named: the spec, the tests, a reference, or the user flows.
- Fixes go back to the **same** builder, which knows why the code is the way it is; reviewers and
  verifiers are always fresh agents (as in `task-lifecycle`).
- Prefer checks that touch the real world: deterministic (compiler, schema, tests) → scored
  (Lighthouse, review severity) → real outcomes (conversion, feedback ratings). A persona judge is
  a starting point, never a replacement for a real signal.
- Leading prompts ("find a bug in billing") always find something. Use them to attack, then a
  neutral check ("I received this report; is it real?") to drop invented findings.
- Stop by rule, not by mood: at most 3 rounds, or when no medium or high finding remains,
  whichever comes first. Verify the likely user flows, not the long tail.
- Every loop leaves an artefact: a short log of decisions, fixes and the score over time.

## Writing a goal

Two failures: it never finishes (the check is too strict or impossible) or it finishes early
without doing what you meant (the check is vague). Both are check problems. State the outcome, the
current baseline, exactly what the verifier checks, and the finish line. Treat uncertainty as not
done. Ask a fresh session to critique the goal before running it.

## Keeping loops healthy

- Guard against duplicates: before starting, check for an open PR or issue from the same loop.
- Give each loop an expiry, or let it slow down as easy wins run out.
- Loops judged by real-world signals go stale (the output converges). Delete and restart with
  fresh data, or feed in new ideas from a separate loop.
- Review loops every few weeks: kill the ones that no longer help, merge the ones that overlap,
  and check skills and loops do not contradict each other.

## Good first loops for this repo

1. **CI on `main`** (watch and react): when a Lovable or agent push turns CI red, reproduce, fix,
   push, stop when green. Check: the CI job itself.
2. **Card drafting** (L2): draft a card from owner notes → `bunx vitest run src/test/content-*` →
   a neutral reviewer checks no real-interview claim, no names in `live`, no invented reference →
   fix, at most 3 rounds. The owner approves; the loop never sets `status: "approved"`.
3. **PR review babysitter** (`/loop` every 10 minutes): address new review comments until 10 quiet
   minutes pass with no medium or high comment.
4. **Card freshness** (scheduled, monthly): list cards past `recheckBy` or tied to current affairs
   and open one issue each.
5. **Feedback quality** (later, L5): sample saved transcripts and feedback with `src/lib/evals/`
   once transcripts are stored, and file issues for weak patterns.
