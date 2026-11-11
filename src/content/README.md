# src/content: the tutor context layer

Server-only. Import from `*.server.ts` files, never browser code. Spec: `docs/context-layer-spec.md`.

- `core.ts` shared rules for every tutor, `PEDAGOGY_VERSION`, `LIMITS`.
- `tutors/<id>/persona.ts` persona, reasoning guide, reading list; `tutors/<id>/index.ts` builds the `Tutor`.
- `tutors/<id>/cards/<card-id>.ts` one card per file; `cards/index.ts` lists them.
- `index.ts` registry (`tutorById`, `cardsFor`, `cardById`); `select-cards.ts`; `build-session.ts`.

## Add a card

1. Copy `tutors/geography/cards/river-person.ts` to `cards/<new-id>.ts`. The file name is the id.
2. Fill every field. `live` (max 200 words) goes to the voice model: hook, the tension,
   3-4 push-on lines, plain language, no academic or author names. `deep` (max 500 words) goes
   only to the backend and feedback: the argument, counter-positions, weak moves; may name academics.
3. Put every academic in `sources[].authors`. Use only references already in our notes or the
   approved reading list; never invent one. Own words only; link, never copy.
4. `status: "draft"` until a named human has reviewed it; then `"approved"`, `reviewedBy`,
   `reviewedAt` (YYYY-MM-DD). Add `recheckBy` (12 months on) for cards based on recent research.
5. `related`: ids of existing cards that follow naturally. Prefer a mix of strands.
6. Import it in `cards/index.ts` and add it to the array.
7. `bunx vitest run src/test/content-*` — the lint test checks word limits, names, ids, dates,
   the opening byte limit and the 2,000-word live budget over every card of every tutor.

Never say or imply a question was asked in a real interview.

## Add a tutor

1. Add the id to `TutorId` in `types.ts`.
2. Create `tutors/<id>/persona.ts` (fictional name, never a real academic), `cards/`, and an
   `index.ts` exporting a `Tutor` (copy `tutors/geography/index.ts`). Start `version` at 1.0.0.
3. Add one line to `TUTORS` in `index.ts`. The tests then cover the new tutor automatically.

Bump a tutor's `version` (semver) on any change to its persona or cards, and
`PEDAGOGY_VERSION` on any change to `core.ts`.
