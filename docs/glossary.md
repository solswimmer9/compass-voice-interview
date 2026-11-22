# Glossary

Words to use when prompting agents about this codebase. Term → what it means → where it lives.
Append when an agent had to translate one of your words.

| Term | Meaning | Where |
|---|---|---|
| Tutor | A subject pack: persona, reasoning guide, reading list, cards. Two exist: `geography` (Dr River) and `ppe` (Prof Matt) | `src/content/tutors/<id>/` |
| Card (topic card) | One interview theme: `opening`, `live`, `deep`, `related`, `sources`, `status` | `src/content/tutors/<id>/cards/<card-id>.ts` |
| Opening | The question asked aloud first; must fit the 480-byte greeting limit | `card.opening` |
| Live text | What the voice model hears (max 200 words, no academic names) | `card.live` |
| Deep notes | Background for the backend and feedback models only; may name academics | `card.deep` |
| Strand | A part of a subject: geography `human`/`physical`; PPE `philosophy`/`politics`/`economics` | `card.strand` |
| Approved / draft | Only approved cards reach students; testers also hear drafts | `card.status` |
| Session context | One interview's built prompts: `liveInstructions`, `opening`, `backendContext`, `promptHash` | `src/content/build-session.ts` |
| Relay | The server WebSocket between browser and the Lovable Live gateway; authenticates, takes the credit, sends the prompt | `src/lib/live-relay.server.ts` |
| Delegation | The voice model handing a hard turn to the backend text model for an 80-word challenge | `answerQuestion` in the relay |
| Greeting | The opening instruction appended once the call connects | `requestGreeting` in the relay |
| Interview credit | One interview allowance, consumed by the `consume_interview_credit` database function and released if the voice start fails | relay `authorizeStart` |
| Feedback | The post-interview assessment; one per interview via `consume_feedback` | `src/lib/assess.server.ts` |
| Tester | A signed-in account in the `PREVIEW_TESTER_EMAILS` secret; unlimited, no credits | `src/lib/testers.ts` |
| Preview mode | Browser-only UI choice by hostname; grants nothing on the server | `src/lib/preview.ts` |
| Reading | A practice article a geography interview can open on | `src/lib/readings.ts` |
| Fixed prompt | Dr River's original prompt, still used for geography | `src/lib/interview-briefing.ts` |
| School bundle | Shared interviews bought by a school and claimed by students with a code | database functions (Lovable-managed) |
| Lovable-managed | Database, migrations, secrets, generated files: change through Lovable, not by hand | `AGENTS.md` |
