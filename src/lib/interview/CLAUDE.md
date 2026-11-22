# Turn analyst, phase director and manifest

Loaded when Claude reads files in this folder. Moved here from the root AGENTS.md on 22 Nov 2026.

- The turn analyst and phase director (`src/lib/interview/live-director.ts`, wired in `live-relay.server.ts`) run only for tester accounts, where they steer the live tutor after each student turn. For students they are off: the old shadow mode cost a model call per student turn and its logs were unused (owner's decision, 22 November 2026, reversing 19 November). To steer students too, change `steer` in `startDirector` calls; `src/test/live-delegation.test.ts` guards both modes.
- Every interview logs one `interview.manifest` line at session start (`buildRunManifest` in `src/lib/interview/manifest.ts`): tutor pack and version (`fixed-briefing` for students on the fixed Dr River prompt), cards, models, director and feedback pipeline versions, and a SHA-256 of the exact instructions sent. Nothing personal and no transcript. Model names live only in `src/lib/models.ts`.
