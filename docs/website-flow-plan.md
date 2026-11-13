# Website flow plan (draft, from the paper sketch)

Status: planning only. Nothing built yet. Open questions are at the bottom.

## The flow you sketched

```
Home ──► Pick a subject ──► Orb (interview) ──► Feedback letter ──► Pricing  or  back to Home
              │                    │
              └─ Reading list?     └─ "Objects" happen inside the interview
```

## What the site does today

| Step | Today | Address |
|---|---|---|
| Home | Headline + "Choose your subject" button that scrolls down the same page to the two subject cards, plus a 3-step "Talk / Get feedback / Read back" strip | `/` (subjects at `/#subjects`) |
| Pick a subject | Not its own page. `/tutors` just redirects to `/#subjects` | — |
| Readings | Separate page, Geography only, linked from the top nav. Each reading has a 15-minute timer page that then starts a Geography interview about that article | `/readings`, `/readings/<id>` |
| Orb | Interview room: orb, Start, timer, Mute / End, optional live transcript | `/interview` (`?tutor=ppe` for PPE) |
| Feedback | Same page as the orb. When the call ends the orb section disappears and the feedback panel appears in its place | still `/interview` |
| After feedback | "Start a new interview" or "Try another subject". No link to pricing unless you are out of credits | — |

### What the feedback ("analysis") currently is

You press **Get my feedback** (optionally attaching a video under 20 MB). The server reads the transcript
and streams back five boxed sections:

1. Overall impression (2–3 sentences)
2. Strengths in reasoning (quotes you)
3. Where the reasoning slipped
4. Targeted improvements (3 actions)
5. Try this next (one follow-up question)

One feedback report per interview, enforced on the server. Below it, the full transcript is folded away.

## Proposed new flow

1. **Home `/`**: headline and one button, "Start practising" → goes to the subject page (no more scrolling to cards).
2. **Pick a subject `/subjects`** (new page): PPE and Geography cards. Readings shown underneath (see Q3–Q5).
3. **Orb `/interview`**: unchanged room. When the call ends, the student moves to the feedback page automatically.
4. **Feedback letter `/feedback`** (new page): the report written as a letter from the tutor (see Q7–Q9), transcript underneath.
5. **After the letter**: buttons to pricing and home (see Q10).

### Technical notes

- The transcript only lives in the browser's memory today. Moving feedback to its own page means saving it
  (in the browser tab's session storage) before navigating, so a refresh does not lose it. No database change needed.
- Credit and one-feedback-per-interview rules stay on the server unchanged; this is purely layout and navigation.
- Old links (`/tutors`, `/#subjects`, `/?tutor=ppe`) keep working via redirects.

## Open questions

See the chat for the full list; answers will be recorded here.
