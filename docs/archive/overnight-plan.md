# Overnight build plan (10–11 November 2026)

Branch: `experiment/context-layer`. Nothing here touches `main`, the live site, the database, the UI, the models or the gateway settings.

## Rules for tonight

- No changes to the interface, model names, gateway, payments or database.
- No PPE content. The PPE tutor is added as an empty shell that cannot run until Solomon adds and approves cards.
- Geography cards only restructure text already in `src/lib/interview-briefing.ts`.
- New code is additive and tested. The one change to existing server files (relay and feedback reading the new prompt builder) is its own commit, so it can be dropped.
- Anything that needs the database is built as tested logic plus a written request for Lovable, not applied.

## Work packages

| # | Package | Source document | Agent | Depends on | Database needed |
|---|---|---|---|---|---|
| 1 | Content core: types, shared teaching rules, Dr River pack, card selection, prompt builder | context-layer-spec steps 1–2 | Opus | none | no |
| 2 | Feedback quote verifier and generic-phrase detector | architecture §10 | Sonnet | none | no |
| 3 | Grounded feedback pipeline: analyst and writer prompts, schemas, orchestration with the model call injected | architecture §9–10 | Sonnet | 2 | no |
| 4 | Evaluation kit: transcript metrics (talk share, long turns, leading questions), scripted student definitions, thresholds | architecture §12, §14 | Sonnet | none | no |
| 5 | Remaining geography cards, restructured from the existing briefing | context-layer-spec | Sonnet | 1 | no |
| 6 | PPE tutor shell: persona slot and empty card list, disabled | pedagogy (PPE section) | Sonnet (with 5) | 1 | no |
| 7 | Interview director: phases, turn state, difficulty rules, steering notes, run manifest | architecture §6, §11; pedagogy | Sonnet | 1 | no |
| 8 | Student context logic: update from verified evidence, expiry, 80-word summary | architecture §7 | Sonnet (with 7) | 1, 2 | no (storage later) |
| 9 | Wire the prompt builder into the relay and feedback; server accepts a tutor id, defaulting to geography | context-layer-spec step 2 | Opus | 1, 5, 6 | no |
| 10 | Review, full checks, push, handover note, Lovable schema request | all | Orchestrator | all | writes the request only |

Packages 1, 2, 3 and 4 run in parallel. Then 5–8 in parallel. Then 9. Then 10.

## Not built tonight, and why

- **Saving transcripts, history page, student memory storage, school accounts.** They need database changes, which must go through Lovable. The request will be written out ready to paste.
- **Tutor picker and stimulus panel.** Interface changes.
- **Turn analyst and steering running live.** They add model calls to real interviews and cannot be tested without the gateway key. The logic is built and tested; switching it on is a morning decision.
- **Grounded feedback live.** Same reason. The pipeline is built with the model call injected so it can be connected in a few lines.
- **PPE, Law and Biology content.**

## What done looks like in the morning

- All checks pass on the branch: tests, type check, lint, build.
- `docs/overnight-handover.md` lists what was built, what was verified and how, what was not, and the decisions waiting for Solomon.
