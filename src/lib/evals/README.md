# Evaluation kit

Building blocks for architecture sections 12 (Evaluation) and 14 (Monitoring), now in use:

- **Every real interview** is scored when it ends: the relay logs an `interview.metrics` line
  (talk share, long and leading tutor turns, references back, gaps, which thresholds were
  missed). Numbers only, never what was said.
- **Scripted students** run with `bun run evals` (`cli.ts`, logic in `runner.ts`): each tutor's
  real student prompt against all ten students in text mode, then metrics, thresholds, the
  judge and a comparison with the previous report in `eval-results/`. It needs
  `LOVABLE_API_KEY`; `bun run evals --dry-run` checks the pipeline with canned replies and
  runs in CI. Options: `--tutor=geography|ppe|all`, `--students=strong,eal`, `--exchanges=6`.

- `metrics.ts`: `groupTurns` merges relay transcript deltas into timed turns;
  `interviewMetrics` computes tutor talk share, long turns, multi-question turns,
  previous-answer references, leading-question candidates, interruptions, turn gaps;
  `checkThresholds` applies `DEFAULT_THRESHOLDS`; `compareRuns` flags measures 5+ points worse.
  Leading and reference measures are regex heuristics (see comments): trend signals, not verdicts.
- `scripted-students.ts`: ten subject-neutral student behaviour profiles with the tutor
  behaviour expected of each. Subject material comes from the pack under test, never from here.
- `judge.ts`: `buildJudgePrompt` and `judgeVerdictSchema` (zod) for a judge model, plus
  `COMMITMENTS` and `EVAL_KIT_VERSION`. The model call is not made here.

## Limits

Real simulations need the gateway key, so CI runs only the unit tests and the dry run. Text
mode stands in for the voice model: it tests the prompt, not the voice. The section 12 list
asks for at least 12 student types; this kit has ten.

## How a runner would use it

1. For each student in `SCRIPTED_STUDENTS` and each pack, run the interviewer prompt against
   a simulator model (given `behaviourRules` plus pack content) in text mode, with synthetic
   timings, collecting `{role, text, start_ms, end_ms}` deltas.
2. `groupTurns` then `interviewMetrics` then `checkThresholds`; store metrics with
   `EVAL_KIT_VERSION` and the pack and prompt versions.
3. Send `buildJudgePrompt(...)` to the judge model, parse with `judgeVerdictSchema`, retry once on failure.
4. `compareRuns` against the stored previous run; block release on any failure or flag.
5. Have a person sample judged transcripts, and run two real voice interviews per changed pack.
