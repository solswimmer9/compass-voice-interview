# Roadmap scenarios (biology and other sciences)

Science interviews have right answers and must move forward, so they are not built from topic
cards. Each scenario is one file: a run of questions ("steps") the tutor works through in order.

## How an interview runs

1. Dr Toby asks step 1. His instructions hold **only the step he is on** (its question, the points
   a full answer covers, its hints and its rules) plus the next question. He never sees a step's
   `answer`, or any later step, until he gets there, so he cannot give answers away early.
2. After every student answer, a checker (a quick text model) ticks off which points the student
   has made, from any step, and says whether the answer was an attempt, a clarifying question, an
   understanding question or "I'm stuck".
3. The code (`src/lib/interview/roadmap.ts`) then decides, the same way every time:
   - **All points covered:** move on. Steps the student has already answered are skipped; a step
     they half-answered is asked as "Earlier you mentioned..., can you expand on...".
   - **Stuck** (an answer that adds nothing new, or an understanding question): Dr Toby gives the
     next hint. Clarifying questions are answered freely and never use up a hint.
   - **Stuck for longer than the hints last** (at most 3): he is told to give the `answer` and
     move on.
   - **A step with a diagram:** the diagram appears on the student's screen as the step starts.
   - **Last step done:** he closes with the `closing` text.

## Write a new scenario

Copy `pcr.ts` to `<topic>.ts` and fill it in. Plain English throughout; no code knowledge needed
beyond keeping the quotes and commas in place.

| Field             | What to write                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | Short and neutral, e.g. `bio-enzymes`. The student's browser sees it.                                                                                          |
| `status`          | `"draft"` until you or the owner have tried it; drafts are for tester accounts only. Then `"approved"` with `reviewedBy` and `reviewedAt` (YYYY-MM-DD).        |
| `knowledge`       | Everything a marker needs to judge answers. Goes to the checker and feedback, never to the voice whole.                                                        |
| `steps[].ask`     | The question, as you would say it aloud.                                                                                                                       |
| `steps[].points`  | What a full answer covers, one idea each, with a short `id`. Judged on meaning, not wording.                                                                   |
| `steps[].hints`   | Up to 3, mildest first. A nudge towards the idea, never the idea itself. Your "IF the student cannot..." prompts go here.                                      |
| `steps[].answer`  | What Dr Toby says once the hints have run out.                                                                                                                 |
| `steps[].rules`   | Your other IF statements, in plain words, e.g. "If they give the right temperatures in the wrong order, say: ...".                                             |
| `steps[].diagram` | Optional. Built with `thermalCycleSvg` or `flowSvg` in `diagrams.ts`, or ask Claude to draw a new kind. `shows` describes it for the tutor, who cannot see it. |
| `closing`         | How to end once the last step is done.                                                                                                                         |

Then add it to `SCENARIOS` in `index.ts` and run `bunx vitest run src/test/biology-roadmap.test.ts`.
The test rejects a scenario with a missing field, duplicate ids, more than 3 hints, or a prompt
over the live word limit.

Tips from the PCR scenario: keep each step to one idea; put the "almost, but..." corrections in
`rules`; if a later question gives away an earlier answer (for example, it mentions the
temperatures), that is fine, because Dr Toby only reads it once the earlier step is done.
