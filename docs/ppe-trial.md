# PPE trial (Prof Matt)

Branch `claude/awesome-ptolemy-giorgb`. An experiment: tester accounts can run Oxford-style PPE
interviews with Prof Matt. Geography and everything students see are unchanged.

## How to try it

1. Sign in with an account listed in `PREVIEW_TESTER_EMAILS`.
2. Open `/?tutor=ppe` (in preview the page also shows a "Tutor: Geography | PPE" switch).
3. Start the interview. Prof Matt introduces a practice Oxford-style PPE interview and asks one of
   the ten draft openings; a new interview rotates to another.
4. End it and request feedback. Same five headings, judged against the PPE reasoning guide and
   the notes of the cards used.

## What changed

| Area | Change |
|---|---|
| `src/content/tutors/ppe/cards/` | 40 **draft** cards. 30 come from Solomon's PPE interview pack (11 November 2026): Political Currency themes, What? Why? When? themes and ten recent Oxford papers, using the pack's 51 original questions as openings and push-ons. 10 are Claude's earlier placeholders (delete freely). |
| `src/content/tutors/ppe/persona.ts` | Reading list from the pack (two podcasts, eleven papers); Oxford PPE criteria and the pack's practice routine in the reasoning guide. |
| `src/lib/ppe-trial.server.ts` | Builds Prof Matt's session from draft cards; PPE feedback notes. |
| `src/lib/live-relay.server.ts` | `app.start` with `tutorId: "ppe"`: tester accounts only, never consumes or releases credits; anyone else gets "The PPE tutor is still being tested". Any other unknown tutor is refused. No `tutorId` keeps the original Dr River prompt exactly. |
| `src/lib/assess.server.ts` | `tutorId: "ppe"` uses a PPE feedback prompt; refused (403) for non-testers before any allowance or rate limit is used. |
| `src/routes/index.tsx`, `AssessPanel.tsx` | `?tutor=ppe` labels, trial notice, tutor switch in preview, sends `tutorId` and `cardIds`. |
| `src/content/core.ts` | Shared voice policy now carries the Mannerisms and Pause lines the relay already uses ("supervision" reads "tutorial"); `PEDAGOGY_VERSION` 1.1.0. Only content-layer sessions (PPE) use it. |

PPE stays closed to students: `isTutorAvailable("ppe")` is false while every card is a draft.

## Before PPE can open to students

1. Review the ten cards; edit, approve (`status: "approved"`, `reviewedBy`, `reviewedAt`) or delete.
2. Confirm the tutor name (see the note below) and trim the reading list.
3. Replace the trial path with the normal content-layer path and a credit check, and move the
   tutor switch out of preview.

Not yet tried in a real voice call.

## How the pack was used

- Openings and push-ons are the pack's original practice questions, lightly shortened for speech.
- What the voice model hears names no academic, host or politician; names, papers and links are
  in each card's `deep` notes and `sources`, which only the backend and feedback see.
- Paper summaries are in our own words; no abstract is copied, including the openly licensed ones.
- Left out on purpose: the publisher's claim that the kidney prompt was a real Oxford interview
  question (the tutor must never say a question was asked in a real interview), and the 30-minute
  mock format (interviews here last 20 minutes).
- Current-affairs cards (Political Currency, October to November 2026) will date; review them each term.

## Name

`Prof Matt` was set in Lovable. The pack draws heavily on Dr Matt Williams of Jesus College, a real
Oxford fellow, so a tutor called "Prof Matt" could read as him or as endorsed by him. The project rule
is a fictional name that is never a real academic's. Worth choosing a name that cannot be confused.
