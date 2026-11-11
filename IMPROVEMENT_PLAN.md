# Compass Voice Interview: review and improvement plan

Reviewed 11 Nov 2026. Three read-only reviews covered the voice and feedback core, payments and security, and code quality, tests and content. The most serious finding (step 1) was checked against the migrations by hand.

## Rating: 6.5 / 10

The product idea, the teaching design and the engineering discipline are strong for a solo Lovable build. It loses points for one confirmed way to get free interviews, calls that drop easily and burn a paid credit, feedback graded on a transcript the student can edit, and about 2k lines of good, tested code that the app never uses.

## What's working well

- **Interview teaching.** The Dr River briefing (`src/lib/interview-briefing.ts`) has concrete push-back moves, care rules, political neutrality and calibration to Year 13. The approved question cards in `src/content/` are high quality.
- **Lifecycle code.** Both sides of the call have explicit state machines and timeouts at every stage, stop is idempotent, the credit is refunded if a call never starts, and stale backend answers are discarded.
- **Payment foundations.** Webhooks are signature-checked and idempotent, credits are consumed atomically under an advisory lock, row-level security is on everywhere and the price allowlist is set on the server.
- **Discipline.** TypeScript is very strict, CI runs a type check, the tests and a build, and there are 21 test files concentrated on the money and access paths.

## What's not working

1. **Confirmed revenue leak.** `release_interview_credit` is still granted to `authenticated` (`drizzle/migrations/0000_…sql:185`; 0001 only revoked it from PUBLIC and anon). A signed-in user can call it from the browser after a finished call that had no feedback. That deletes the session and gives the credit back, and for the free interview it resets the free allowance. Unlimited free interviews.
2. **Fragile calls.** Heartbeats fail the call after 5s, and a brief network blip ("disconnected") ends it. There is no reconnect, and once the call was "ready" the credit is gone. The 20-minute hard cut ends in an error, not a proper close.
3. **Feedback is unreliable and gameable.** It grades a transcript the client sends and the student can edit. The server throws its own copy away. A refresh loses the replay. The feedback credit is spent before generation, so a model error or pressing Stop burns it.
4. **Unused work.** The director, turn analyst, quote-verified feedback pipeline, evals and the content-layer session builder are used only by tests. The live path still uses the old fixed prompt.
5. **Thin first impression.** The landing page is also the interview room. A signed-out student has no taste of the product, no sample, no microphone check, and the £20 pack is hard to find.

## The plan (80/20 order)

### Step 1: Close the money holes (about half a day)

These are database changes, so they go through Lovable per `AGENTS.md`.

- [ ] `REVOKE EXECUTE ON FUNCTION public.release_interview_credit(uuid) FROM authenticated;` and call it only from the relay with the service role plus a user-id check.
- [ ] Refund failed starts based on what the server saw (the gateway session never started, or the call was under N seconds), not on the client's `app.ready` message.
- [ ] Pick the payments environment (sandbox or live) on the server. Reject `sandbox` in production checkout, relay and account functions.
- [ ] Turn on email confirmation, and require a confirmed email before granting tester status.
- [ ] Wire up `takeInterview` (already written, `src/lib/rate-limit.server.ts:51`) and add a guard against one user running parallel sessions. Key the feedback limit on the user ID, not the IP (schools sit behind one IP).
- [ ] Cap claims per student on each school bundle. Validate the checkout `returnUrl` against the site's own origin.

### Step 2: Make the core loop trustworthy (2 to 3 days)

- [ ] **Save the transcript on the server** in `finish()` in the relay, keyed by interview. `/api/assess` grades the stored copy, the editable textarea goes, and the replay survives a refresh.
- [ ] **Don't burn feedback on failure.** Consume the credit only when the stream completes, or add a release on error or abort.
- [ ] **Survive network blips.** Tolerate "disconnected" for about 15s, call `restartIce()`, widen the heartbeat window to 10 to 15s, and refund the credit if a call dies in its first few minutes.
- [ ] **Time-cue the tutor.** Around 16 minutes, prompt it to start pulling the answers together. Around 19 minutes, have it close warmly with two strengths and two improvements. End with a goodbye, not an error banner.

### Step 3: Ship the work that's already built (2 to 3 days)

- [ ] Reapply the content-layer switch (`62090d9`, reverted per `docs/overnight-handover.md`) and test it by voice, behind the tester flag.
- [ ] Use the quote-verified feedback pipeline (`src/lib/feedback/pipeline.ts`), with the current feedback as fallback. Render the feedback as proper Markdown.
- [ ] Tidy the delegation path. Merge transcript fragments into turns, cap the history, re-run only after the student finishes a turn, and remove the leftover study-schedule template code and the failure text that gets read out.

### Step 4: Cheap hygiene (half a day)

- [ ] Add `bun run lint` to CI and fix the existing errors.
- [ ] Move `appendTranscriptFragment` out of `src/routes/index.tsx` into `src/lib/transcript.ts` and unit-test it. Add one test of the interview page's states with `useLiveVoice` mocked.
- [ ] Delete the 44 unused shadcn components and the dependencies nothing imports (recharts, cmdk, embla, vaul, date-fns, react-hook-form…).
- [ ] Replace the "Lovable AI" credit in the customer copy.

### Deliberately not now

Multi-subject and PPE, and more architecture docs. Two core roadmap items are still open: a real end-to-end purchase and refund, and audible two-way voice in a real browser. Those come first.

## Features worth adding (in order)

1. **Free taster and a sample replay.** A 3-minute mini interview on one card for signed-out users, or a public annotated example transcript. This shows the value before signup, which is the biggest conversion lever.
2. **Interview history and "Dr River remembers".** Saved transcripts and feedback, a trend of your recurring weak moves, and a next interview that targets your recurring habit. `src/content/memory.ts` and `student-context.ts` are already designed for this. It's the main reason to buy repeat packs.
3. **Clickable replay plus a "re-answer this moment" drill.** Each feedback point jumps to the quoted turn, and a 2-minute mini-call replays your weakest exchange.
4. _(For schools)_ **A teacher dashboard with only anonymised cohort totals.** The £1,250 schools offer currently says "teacher overview in development".
