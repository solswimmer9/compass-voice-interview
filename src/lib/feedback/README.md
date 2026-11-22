# Feedback

Two paths, chosen in `src/lib/assess.server.ts` after every access rule has run and the feedback allowance has been charged once:

- **Every account with a transcript of at least two student turns and no video:** the evidence-checked pipeline (`pipeline.ts`, run by `grounded.server.ts`, rendered and re-checked by `grounded-output.ts`). The argument map is requested in parallel by `argument-map.server.ts` and appended after the checked letter in the same `<<<ARGUMENT_MAP>>>` form the panel reads; an unusable map is dropped and the letter shows alone. On any pipeline failure, timeout or failed check it falls back silently to the path below. Owner's decision, 14 November 2026.
- **Videos, very short transcripts and fallbacks:** one streamed model call (`startTodayFeedback`). Its prompt and request stay unchanged unless Solomon asks for a change.

Rules:

- Students' analyst gets approved notes only (`includeDrafts: false`); only `isServerTester` adds draft PPE notes. Never a request field, hostname or environment flag.
- Object interviews pass the chart's notes to the analyst (`objectContext`), as the single-call prompt does.
- Fail closed: if the checker cannot read a quoting construct, drop the line or fall back. Never show a quotation that has not been matched to the student's own words.
- `word-limit.ts` applies to both paths. The streamed output must always equal `limitWords(fullText)`; the argument map block sits after the letter and is not counted.
- The checked path costs three text-model calls (analyst, writer, argument map) plus at most one rewrite, against one call for the single-call path. A fallback adds the single streamed call on top of whatever the pipeline already spent.
- The checked letter cannot stream: the student sees nothing until it has passed every check (up to `GROUNDED_TIMEOUT_MS`, 60 s, before a fallback starts streaming). The letter is sent as soon as it is ready; the map then has at most `MAP_GRACE_MS` (10 s) more, after which any map call still running is cancelled.
- The quote check covers the letter only. The argument map comes from a separate call that never sees the letter, so it is validated for shape (`parseArgumentMap`) but not quote-checked, exactly as on the single-call path.
- Logs carry counts and reasons only, never transcript text.

Known low-severity gaps are listed in `docs/archive/overnight/2026-11-12-handover.md`.
