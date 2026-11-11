# PPE trial (Dr Vale)

Branch `claude/awesome-ptolemy-giorgb`. An experiment: tester accounts can run Oxford-style PPE
interviews with Dr Vale. Geography and everything students see are unchanged.

## How to try it

1. Sign in with an account listed in `PREVIEW_TESTER_EMAILS`.
2. Open `/?tutor=ppe` (in preview the page also shows a "Tutor: Geography | PPE" switch).
3. Start the interview. Dr Vale introduces a practice Oxford-style PPE interview and asks one of
   the ten draft openings; a new interview rotates to another.
4. End it and request feedback. Same five headings, judged against the PPE reasoning guide and
   the notes of the cards used.

## What changed

| Area | Change |
|---|---|
| `src/content/tutors/ppe/cards/` | 10 **draft** cards: 3 philosophy, 3 politics, 4 economics. Written by Claude in its own words, no outside sources, no authors named. |
| `src/lib/ppe-trial.server.ts` | Builds Dr Vale's session from draft cards; PPE feedback notes. |
| `src/lib/live-relay.server.ts` | `app.start` with `tutorId: "ppe"`: tester accounts only, never consumes or releases credits; anyone else gets "The PPE tutor is still being tested". Any other unknown tutor is refused. No `tutorId` keeps the original Dr River prompt exactly. |
| `src/lib/assess.server.ts` | `tutorId: "ppe"` uses a PPE feedback prompt; refused (403) for non-testers before any allowance or rate limit is used. |
| `src/routes/index.tsx`, `AssessPanel.tsx` | `?tutor=ppe` labels, trial notice, tutor switch in preview, sends `tutorId` and `cardIds`. |
| `src/content/core.ts` | Shared voice policy now carries the Mannerisms and Pause lines the relay already uses ("supervision" reads "tutorial"); `PEDAGOGY_VERSION` 1.1.0. Only content-layer sessions (PPE) use it. |

PPE stays closed to students: `isTutorAvailable("ppe")` is false while every card is a draft.

## Before PPE can open to students

1. Review the ten cards; edit, approve (`status: "approved"`, `reviewedBy`, `reviewedAt`) or delete.
2. Choose Dr Vale's final name and the PPE reading list (currently empty on purpose).
3. Replace the trial path with the normal content-layer path and a credit check, and move the
   tutor switch out of preview.

Not yet tried in a real voice call.
