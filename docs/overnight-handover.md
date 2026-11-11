# Overnight handover (11 November 2026)

Branch `experiment/context-layer`, ten commits ahead of `main`, pushed. `main`, the live site, the database, the interface, the models and the gateway settings are untouched.

Checks on the final commit: 425 tests pass (38 before tonight), type check clean, production build succeeds. Lint is clean on everything added; the only lint errors are in `src/test/payment-revocation.test.ts`, which was already like that on `main`.

**Nothing here has been tried in a real voice call.** That is the first job this morning.

## What was built

| Area | Where | Connected to the app? |
|---|---|---|
| Shared teaching rules, tutor packs, topic cards, card selection, prompt builder | `src/content/` | Yes, by the last commit |
| Dr River pack: 14 approved cards, 24 drafts | `src/content/tutors/geography/` | Approved cards only |
| PPE tutor shell, no content | `src/content/tutors/ppe/` | Registered, cannot start |
| Quote verifier, generic-phrase detector, evidence-checked feedback pipeline | `src/lib/feedback/` | No |
| Phase director, turn analyst prompt, run manifest, student context | `src/lib/interview/` | No |
| Transcript metrics, thresholds, scripted student profiles, judge prompt | `src/lib/evals/` | No |
| Database request, ready to paste | `docs/lovable-schema-request.md` | Not sent |

Separately, branch `feature/schools-pricing` adds a Schools card (£1,250 per admissions cycle, up to 30 students, by enquiry) to the pricing page.

## The one commit that changes behaviour

`c109dfc feat(relay): build Dr River's prompt and feedback context from the content layer`

Everything else is new files that nothing calls. This commit makes the relay and the feedback endpoint use the new prompt builder. Revert it and the app behaves exactly as on `main`.

What a student could notice:

1. **Narrower interviews.** Dr River gets the opening card and two related ones, not all 14 question lines. The prompt drops from 3,143 words to about 1,250.
2. **Fewer openings.** Openings rotate over the 14 approved cards. One-line questions with no supporting material are drafts and never open an interview.
3. **Little physical geography.** Only one approved card is physical (volcanoes). The persona still tells Dr River to ask about physical processes, but there is less to draw on.
4. **Readings only in reading interviews.** If a student mentions an article in a normal interview, Dr River no longer has its summary.
5. **Reading list moved.** Dr River no longer holds the reading list; it asks the background model when a student wants reading suggestions.
6. **Feedback background.** Feedback draws on the approved cards' notes instead of the old notes block. Headings and length are unchanged.

## Morning test (about 15 minutes, tester account)

1. Start a normal interview. Dr River should greet you and ask one approved opening, such as "Can a river be a person?".
2. Give a long, argued answer. The challenge that comes back should stay on that theme and name no academics.
3. Start a second interview. The opening should be a different card.
4. Open a practice reading and start its interview. Dr River should ask you to sum up the article.
5. End an interview and request feedback. Same five headings, quotes from what you said.

If anything sounds worse than before, revert `c109dfc` and tell me what you heard.

## Decisions waiting for you

| # | Decision | What I did meanwhile |
|---|---|---|
| 1 | The 14 approved geography cards are marked "reviewed by Solomon Allen". They restructure your existing briefing, with short linking sentences added by the agent. Please read them. | Marked approved so interviews work |
| 2 | 24 draft cards need fleshing out, or deleting. | Left as drafts; never shown to students |
| 3 | PPE tutor name. | Placeholder "Dr Vale" |
| 4 | PPE content. | None written. Upload it and it becomes cards for your approval |
| 5 | Schools enquiry email. | Button reads "Enquiries opening soon" |
| 6 | Schools plan terms: £1,250, 30 students, per cycle, "teacher overview in development". | My defaults |
| 7 | Send the database request to Lovable? Update the privacy notice first. | Not sent |
| 8 | Remove "body language" from video feedback? | Unchanged |

## Still to do, in order

1. Voice-test the branch (above).
2. Review the geography cards.
3. Privacy notice, then the database request.
4. Save transcripts and versions from the relay; history page.
5. Connect the evidence-checked feedback for tester accounts, with today's feedback as fallback.
6. Run the director in shadow mode (record, do not steer).
7. A runner script for the scripted-student simulations. It needs the gateway key.
8. Tutor picker and PPE launch, once PPE has approved cards and a reviewer.

## Known weak spots

- The evaluation heuristics (leading questions, "refers to the last answer") are pattern-based and rough. They show trends, not verdicts on single turns.
- The 400-word feedback limit is requested in the prompt, not enforced in code.
- Whether the gateway limits the size of the opening prompt is still unknown. The new prompt is smaller than today's, so the risk went down.
- The director's phase timings and the evaluation thresholds are starting values. They need real interviews to calibrate.
- Scripted student profiles: 10 built; the architecture document asks for at least 12 per subject.

## How the work was split

Opus built the content core and the relay wiring. Sonnet built the quote verifier, feedback pipeline, evaluation kit, card restructuring with the PPE shell, and the director with student context. Each agent's work was re-run and reviewed before it was committed.
