# Website flow plan (draft, from the paper sketch)

Status: built on `experiments/ideas` (13 Nov). See "Build order" at the bottom for what shipped.

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

## Decisions so far (13 Nov)

- **Pick a subject is its own page.** Each subject has a "Start interview" button.
- **Start interview opens a new room with the orb, after a short waiting room** while the voice
  agent connects, so the student isn't left watching it boot.
- **Readings:** shown as "coming soon" on the subject page; removed from the top menu.
- **Objects (option A):** the chart/image feature becomes part of every normal interview,
  not a separate "Object interview" mode.

## Found on `main` (not yet on `experiments/ideas`)

`main` is 35 commits ahead of this branch and already has:
- Object interviews: tutor puts an unlabelled chart on the table (`src/content/objects/`,
  approved 12 Nov: Dr River urban/rural share, Prof Matt UK turnout). Today it is a separate
  `?mode=object` link on the picker; the relay only sends a chart in that mode.
- Live room with captions (`LiveRoom.tsx`, `LiveCaption.tsx`).
- Feedback letter from the tutor plus an argument map (`FeedbackLetter.tsx`, `ArgumentMap.tsx`).
- Onboarding: choose a subject first, subject kept through sign-in, clearer mic errors.
- Lovable edit (13 Nov 16:10): "Picking a subject now starts the interview straight away".

Interviews are 20 minutes (`INTERVIEW_MINUTES`).

## Decisions (round 2, 13 Nov)

- Base: `main` merged into `experiments/ideas`, main's code kept (done, commit 153ce1a).
- Chart comes out around minute 8–10 of the 20, in every interview. Same chart each time is fine for now.
- Waiting room lasts until the tutor is connected; the credit is used only once connected.
- When the call ends, go straight to the letter page; the letter starts writing itself.
- Optional video upload: dropped.
- After the letter: head to pricing (home as the secondary link).
- Sign-in asked for at "Start interview" (default, not discussed).

## Build order

1. `/subjects` page with Start buttons; readings "coming soon"; Readings out of the top menu; home button goes to `/subjects`.
2. `/interview` room with a waiting room that connects in the background.
3. Chart in every interview (relay + tutor instructions), timed around minute 8–10.
4. `/feedback` letter page: auto-start, no video, then pricing.
5. Credit only once connected (check relay first).

## What shipped (13 Nov)

| Step | Page | Notes |
|---|---|---|
| Home | `/` | Headline, "Start practising" → `/subjects`. No Readings in the menu. Old `/?tutor=…` links go to `/interview`. |
| Pick a subject | `/subjects` | PPE and Geography cards with "Start interview". Readings shown as "Coming soon". `/tutors` redirects here. |
| Waiting room | `/interview` | "Dr River is getting ready…" with tips, at least 2.5 s, while the call connects in the background. Cancel goes back to subjects. |
| Orb | `/interview` | Live room unchanged. Chart comes out at minute 9 (`OBJECT_REVEAL_MINUTES`). |
| Letter | `/feedback` | Starts writing straight away; no video upload; transcript folded underneath; kept on refresh for this tab. |
| After | `/feedback` | "See pricing" plus "Back to home". |

Credit: already charged at start and automatically restored by the relay if the call never gets going,
so a failed connection costs nothing. No change needed.

## Practice readings (13 Nov, later)

Readings were never removed, only unlinked. They now hang off each subject:

- `src/lib/subjects.ts` lists the subjects (PPE, Geography; Medicine goes here next).
- Each reading in `src/lib/readings.ts` has a `subject`. `readingsFor(subject)` drives the page.
- `/subjects`: a subject with readings shows "Or start with a practice reading (N articles)" under
  Start interview; one without shows "Practice readings coming soon".
- `/readings?subject=geography` lists that subject's readings (old `/readings` links = Geography).
  Each reading → 15-minute reading page → interview on it (no mid-interview chart in reading interviews).
- To add PPE readings: add entries with `subject: "ppe"` and teach Prof Matt's server path
  (`ppe.server.ts`, `live-relay.server.ts`) to open on a reading, as Dr River's does.
