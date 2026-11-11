# Spec: tutor context layer and per-student memory

Status: draft for implementation. Open decisions are listed at the end with a default for each; build to the default unless Solomon has answered.

## Goal

Compass currently has one tutor (Dr River, geography) whose whole knowledge is three hard-coded strings in `src/lib/interview-briefing.ts`, sent in full on every interview. We are adding a second tutor (PPE) with far more source material: reading lists, podcast and video notes, recent papers by Oxford PPE academics, and practice questions. We also want each student's history to shape their next interview.

The design must let the content library grow to hundreds of items per subject without the live voice prompt growing at all, and must add a new subject without touching relay code.

## The principle

The voice model's prompt stays small and curated. Volume lives outside it. A live interviewer given 50 pages of notes lectures, name-drops and slows down, which is the opposite of what `DR_RIVER_BRIEFING` asks for. So content flows through three stages:

1. **Raw sources** (transcripts, papers, reading lists). Never sent to any model at runtime and never shipped in the app bundle.
2. **Topic cards**. Short, human-approved, written in our own words. This is the product's context layer.
3. **Session context**. For each interview, 2–3 cards are chosen and assembled with the persona and the student's memory.

No vector database or embeddings in this version. At a few hundred cards per tutor, selection by tags and student history is enough and adds no latency. Revisit only if a tutor passes about 500 cards.

## Content structure

```
content-raw/                 gitignored; raw transcripts, PDFs, notes
src/content/
  core.ts                    shared rules: format, how to speak, pushback moves,
                             political neutrality, care (lifted from DR_RIVER_BRIEFING)
  types.ts                   Tutor, TopicCard, Source
  tutors/
    geography/
      persona.ts             name, voice, intro, what to look for, reasoning guide
      cards/*.ts             one file per card
    ppe/
      persona.ts
      cards/*.ts
  index.ts                   tutor registry: tutorById(), cardsFor()
```

All of `src/content` is server-only, like `interview-briefing.ts` today.

### TopicCard

```ts
type TopicCard = {
  id: string; // stable slug, stored against interviews
  tutor: "geography" | "ppe";
  strand: string; // geography: "human" | "physical"; ppe: "philosophy" | "politics" | "economics"
  tags: string[];
  status: "draft" | "approved"; // only approved cards are ever selected
  opening: string; // the question as asked aloud; must fit the opening limit (see Constraints)
  live: string; // max ~200 words. Hook, the core tension, 3-4 push-on lines.
  // Plain language, no academic names. Goes to the voice model.
  deep: string; // max ~500 words. The underlying argument, the main
  // counter-positions, common weak moves by candidates.
  // May name academics. Goes only to the backend and feedback models.
  related: string[]; // card ids that follow naturally
  sources: {
    title: string;
    url?: string;
    kind: "paper" | "book" | "podcast" | "video" | "notes" | "question";
  }[];
  reviewedBy: string;
  reviewedAt: string; // ISO date
  recheckBy?: string; // set for cards based on recent research; 12 months after review
};
```

Rules for card text, enforced by a lint test over every card:

- Own words only. No copied passages from sources; we link, as `readings.ts` already does.
- `live` contains no name from that card's `sources` authors.
- Word limits above are hard.
- No card claims a question was asked in a real interview.

### Migration of Dr River

Move the 14 question lines, the notes bullets and the extra question lines into cards. `OPENING_QUESTIONS` becomes the `opening` fields. The approved reading list stays in the geography persona. Behaviour should be unchanged except that an interview now carries 2–3 lines rather than all of them. Existing tests in `src/test` must still pass; update `opening-questions.test.ts` to read from cards.

## Session assembly

A pure function, unit tested:

```ts
buildSession({ tutor, cards, memory, reading }) => {
  liveInstructions: string;   // core + persona + cards[].live + memory.live + voice/delegation policy
  opening: string;            // short opening instruction built from cards[0].opening
  backendContext: string;     // persona.reasoningGuide + cards[].deep + memory.full
}
```

Wire-up:

- `live-relay.server.ts` builds the session after `authorizeStart` and uses `liveInstructions` in `session.start`, `opening` for the greeting, and `backendContext` in the system prompt of `answerQuestion`. The module-level `conversationInstructions` constant goes away.
- `assess.server.ts` uses `backendContext` for the same interview, so feedback is judged against the cards that were actually used.
- The browser sends `tutorId`, and optionally `strand` and `readingId`. It no longer sends `openingTurn`.

Budget, asserted in a test for every tutor and every card combination: `liveInstructions` is at most 2,000 words. Today's prompt is roughly 2,800 words (estimate; measure it first and record the number in the PR).

### Card selection

`selectCards(tutor, history, strand?)`:

1. Candidates are approved cards for the tutor, filtered by strand if given.
2. First card: one the student has not done, else the least recently done.
3. Then up to two more from the first card's `related`, preferring a different strand and not yet done.
4. For a signed-out or first-time student, pick the first card by random.

## Per-student memory

Do not replay past transcripts into a prompt. Keep one small structured summary per student per tutor, rewritten after each interview.

```ts
type StudentMemory = {
  interviews: number;
  cardsDone: { id: string; at: string }[];
  strengths: string[]; // max 3, each under 20 words
  habits: string[]; // recurring weaknesses, max 3, each under 20 words
  nextFocus: string; // one sentence
};
```

- `memory.live` rendered into the voice prompt is at most 80 words, for example: "Third interview. Has covered: rivers as persons, regeneration. Tends to concede as soon as challenged; hold the challenge one turn longer. Do not mention that you have notes on them unless they ask."
- The memory update is produced by the feedback request, not a separate job: after the feedback text streams, one further structured-output call takes the previous memory plus this transcript and returns the new `StudentMemory`. If it fails, keep the old memory.
- A student who never requests feedback still gets `cardsDone` and `interviews` updated when the call ends.

## Storage

Schema changes go through Lovable, not hand-written migrations (see `AGENTS.md`). Ask Lovable for:

- On `interview_sessions`: `tutor_id text`, `card_ids text[]`, `reading_id text`, `transcript jsonb`, `feedback text`, `ended_at timestamptz`.
- New table `student_memory (user_id uuid, tutor_id text, memory jsonb, updated_at timestamptz, primary key (user_id, tutor_id))`. Row-level security: a user can read their own row; writes only through a security-definer function called by the server.
- A function to delete all of a user's transcripts and memory.

The relay already holds the full transcript server-side in `transcripts`. Save it from `finish()` via `execution.waitUntil`, using the server copy, never one posted by the browser. `assess.server.ts` then loads the transcript by `interviewId` instead of trusting the request body. Check first what columns `interview_sessions` has; this spec was written without reading the full table definition.

Tester accounts currently skip `consume_interview_credit` and so have no session row. They need one to test memory; add a path that creates a row without consuming credit.

## Content pipeline

A script, `scripts/draft-cards.ts`, run locally by an agent: reads files in `content-raw/<tutor>/`, and for each source proposes cards with `status: "draft"`. A human edits and flips them to `approved`. Nothing reaches students unreviewed. A second script lists cards past `recheckBy`.

For "recent papers by Oxford PPE academics": the output is cards whose `deep` field summarises the argument and whose `opening` is a question a 17-year-old can reason about without having read it. The tutor never asks a student what a paper says.

## Constraints already in the code

- The opening instruction must be under 480 bytes (`requestGreeting`). Test every card's opening against it.
- Model calls stay on the Lovable gateway with `LOVABLE_API_KEY` server-only.
- Do not weaken `src/lib/testers.ts` or the access tests.
- Whether the gateway caps the size of `session.start` instructions is unknown. Check before relying on the 2,000-word budget.

## Order of work

1. Types, `core.ts`, tutor registry; move Dr River in with no behaviour change.
2. Cards, `selectCards`, `buildSession`, budget and lint tests; relay and assess use them.
3. Storage: save transcript, feedback, card ids. History list on the account page.
4. Memory: update after feedback, inject on start, respect in selection.
5. PPE persona, tutor picker on the home page, first 20 approved PPE cards.
6. Drafting and recheck scripts.

Steps 1–2 need no schema change and can ship first.

## Done when

- Adding a tutor is a new folder under `src/content/tutors` plus one registry line.
- A student's second interview opens on a card they have not done, and the transcript shows the tutor acting on a recorded habit.
- Feedback is generated from the server-saved transcript.
- The budget, lint and opening-length tests pass for every card.
- A student can see past interviews and delete their data.

## Open decisions

| #   | Question                                                                                   | Default if unanswered                                                                       |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | Name of the PPE tutor. "Dr Matt" reads as Dr Matt Williams of Jesus College, a real tutor. | A clearly fictional name, set in `persona.ts`.                                              |
| 2   | Is a PPE interview one strand or mixed?                                                    | Student picks philosophy, politics, economics or mixed.                                     |
| 3   | Who reviews PPE cards for accuracy?                                                        | No PPE card is approved until a named PPE reviewer exists.                                  |
| 4   | Do we hold permission to store podcast and video transcripts?                              | Keep them in gitignored `content-raw/` only; cards carry ideas in our own words and a link. |
| 5   | How long are transcripts kept?                                                             | Until 31 August after the interview season, then deleted; memory kept.                      |
| 6   | Can teachers on a school licence read student transcripts?                                 | No. Teachers see counts, topics and feedback summaries only.                                |
| 7   | Does the tutor say it remembers the student?                                               | No, unless asked. It just acts on it.                                                       |
