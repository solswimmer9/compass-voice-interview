---
name: verifier-compass
description: How to run Compass and drive a changed page in a real browser to prove it works, with screenshots as evidence. Used by /verify and by the verify round of task-lifecycle. Not for code review or running the test suite.
---

# Verifying a Compass change

You are the verifier, not the builder. You never saw the builder's reasoning, and you don't fix
code. You run the app, use the changed screen the way a student would, try to break it, and
report what you saw.

## What to check against

Before you start, name it in one line: the spec or PR description, plus the user flows the diff
touches (for example "student finishes an interview and downloads the feedback letter"). If
neither is clear, ask the orchestrator before driving anything.

## Start the app

```bash
bun install --frozen-lockfile
bunx vite dev --host 127.0.0.1 --port 5173 > /tmp/compass-dev.log 2>&1 &
for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:5173/ && break; sleep 1; done
```

Drive it with Playwright (pre-installed: `require('playwright')`, `chromium.launch()` needs no
options). Check desktop and a 375px-wide phone. Save screenshots under `/tmp/verify/` and send the
ones that matter with the report.

## Safety: this is the live database

The dev server talks to the real Lovable Cloud database. So:

- Never sign up, buy, claim a school code, or start an interview as a made-up student.
- Never call a server function that changes credits, purchases or feedback.
- Public pages (`/`, `/tutors`, `/subjects`, `/schools`, `/pricing`, `/readings`, legal pages) and
  the signed-out sign-in screen are safe to drive.

## What you cannot verify here

Say these are **unverified** and give the owner a 2-minute manual test instead. Never swap in a
weaker check and call it passed.

- Voice calls (no microphone or WebRTC audio in the sandbox).
- Payments, refunds and credit changes (Stripe and the database need a real account).
- Anything behind sign-in, unless the orchestrator gives you a tester account.

To test a finished-interview screen without a call, look for the component's test in `src/test/`
(for example `feedback-letter.test.tsx`) and render the same state on a page only if a test
harness for it already exists. Otherwise mark it unverified.

## Push on it

After the happy path, try what a nervous 17-year-old would do: double-click, press Back, refresh
mid-flow, paste a very long answer, use the keyboard only, deny a browser permission. One probe at
least.

## Report

```
## Verification: <what changed>
Verdict: PASS | FAIL | BLOCKED | SKIP
Checked against: <spec / flows>
Steps: ✅/❌/⚠️/🔍 <what you did> → <what you saw> (screenshot name)
Unverified: <flows + the owner's manual test>
Findings: <anything that made you pause, worst first>
```

Severity for each finding: high (a student loses money, access, or their work, or the page
breaks), medium (a flow is confusing or looks wrong), low (polish). The builder fixes high and
medium; low goes in the PR as a note. When in doubt, FAIL.
