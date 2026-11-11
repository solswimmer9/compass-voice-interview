# PPE with Prof Matt

Oxford-style PPE interviews are open to everyone at `/?tutor=ppe`, or by choosing
"PPE · Prof Matt" on the home page. Geography with Dr River is unchanged.

## Access

| Who | Interview | Cards heard | Feedback |
|---|---|---|---|
| Student | Sign-in plus one interview credit, exactly as geography; refunded automatically if the voice start fails | Approved cards only | One per interview, from approved notes only |
| Tester (`PREVIEW_TESTER_EMAILS`) | Unlimited, no credits | Approved and draft cards | Unlimited, may use draft notes |

The interview is built after sign-in and before the credit is taken, so a content problem never
costs a student an interview. School codes, packs and lifetime access all work for PPE, since they
are the same interview credits.

## Content

- `src/content/tutors/ppe/cards/`: 40 cards; 9 approved by Solomon Allen on 2026-11-11 (see
  `docs/ppe-cards-review.md`), 31 drafts. Approving a draft makes it available to students at once.
- 30 cards come from Solomon's PPE interview pack (11 November 2026): Political Currency themes,
  What? Why? When? themes and ten recent Oxford papers. 10 are Claude's earlier placeholders.
- `src/content/tutors/ppe/persona.ts`: persona, reasoning guide, and the reading list from the pack.
- Cards from recent research or current affairs carry `recheckBy` dates; review them each term.

## How the pack was used

- Openings and push-ons are the pack's original practice questions, lightly shortened for speech.
- What the voice model hears names no academic, host or politician; names, papers and links are in
  each card's `deep` notes and `sources`, which only the backend and feedback see.
- Paper summaries are in our own words; no abstract is copied.
- Left out on purpose: the publisher's claim that the kidney prompt was a real Oxford interview
  question (the tutor must never say a question was asked in a real interview), and the 30-minute
  mock format (interviews here last 20 minutes).

## Open points

- **Name.** `Prof Matt` was set in Lovable. The pack draws heavily on Dr Matt Williams of Jesus
  College, a real Oxford fellow, so the name could read as him or as endorsed by him. The project rule
  is a fictional name that is never a real academic's.
- **Voice test.** Not yet tried in a real voice call.
- **Schools page** still describes the bundle as geography interviews; the codes work for PPE too.
