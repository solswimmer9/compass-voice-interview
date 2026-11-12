# Feedback

Two paths, chosen in `src/lib/assess.server.ts` after every access rule has run:

- **Everyone:** one streamed model call (`startTodayFeedback`). The prompt and request must stay identical to what students get today unless Solomon asks for a change.
- **Tester accounts with a transcript and no video:** the evidence-checked pipeline (`pipeline.ts`, run by `grounded.server.ts`, rendered and re-checked by `grounded-output.ts`). On any failure, timeout or failed check it falls back silently to the path above.

Rules:

- Only `isServerTester` selects the checked path. Never a request field, hostname or environment flag.
- Fail closed: if the checker cannot read a quoting construct, drop the line or fall back. Never show a quotation that has not been matched to the student's own words.
- `word-limit.ts` applies to both paths. The streamed output must always equal `limitWords(fullText)`.
- Logs carry counts and reasons only, never transcript text.

Known low-severity gaps are listed in `docs/overnight/2026-11-12-handover.md`.
