---
name: context-layer
description: Use when adding, moving or pruning agent context in this repo (AGENTS.md files, docs/architecture, docs/decisions ADRs, the glossary), after an agent repeats a mistake, or when a design decision is made that future agents must not reopen. Not for tutor content cards (see src/content/README.md).
---

# Context layer

Agents rarely fail for lack of a clever prompt; they fail because the plan was made without a fact
that lived in someone's head. The context layer is a thin, token-cheap layer over the code that
gives each agent the right facts at the moment it needs them, and nothing else.

Two rules decide everything: **signal over noise** (every extra line dilutes every other line) and
**load only when needed** (a short root file that points; detail sits next to the code it governs).

## Where each kind of fact goes

| Fact | Home | Edited how |
|---|---|---|
| How agents must behave here; durable stack facts; pointers | `AGENTS.md` (root). Keep it short: a pointer, not a holder | In place |
| Rules for one area (where responsibility or a contract changes) | `AGENTS.md` inside that folder, e.g. `src/content/`, `src/lib/` | In place |
| What must be true now: invariants, which surface enforces each, which test guards it | `docs/architecture/<subsystem>.md` | In place |
| Why we decided something | `docs/decisions/NNNN-<what-we-say-no-to>.md` (template: `adr-template.md`) | Never edited; superseded |
| Words to use in prompts | `docs/glossary.md` | Append |
| Task workflows and checklists | `.claude/skills/<name>/SKILL.md` | In place |
| Hard rules ("never run X") | A hook or a test, not prose | In code |
| Specs and plans | A GitHub issue, closed when done. If kept in the repo, `docs/specs/{draft,active,merged}/` so the path tells agents how far to trust it | Moved between folders |
| What one task changed and why | `implementation-notes.md` for that task, not the permanent layer | Per task |

The code itself is the source of truth for anything the code says. Do not restate it.

## Where to put a nested AGENTS.md

At semantic boundaries only: where responsibility shifts, where other parts depend on a contract,
or where the code is unusual. Not in every folder. Agents load the root, then each node on the path
to the file they touch, so a node should name its child nodes and point sideways to related areas.

Candidates in this repo: `src/content/` (its README already acts as one), `src/lib/` (relay,
payments, feedback: the credit and tester rules), `supabase/` (Lovable-managed; do not hand-edit).

## What a node holds

1. Commands first (test, build, lint), exactly as run.
2. A minimal map: only the non-obvious locations.
3. Invariants with the *why*, e.g. "credits are consumed only in database functions, because
   client checks can be bypassed".
4. Pointers instead of prose: "for a new card, copy `tutors/geography/cards/river-person.ts`".
5. Gotchas an agent had to discover by trial and error.
6. Which skill to use for which task.

Never: generic advice ("write clean code", "handle errors properly"), what a linter already checks,
standard framework conventions, build history, feature lists, tables of contents, plans, long
how-tos (make a skill), or deep folder trees.

**Size:** aim for under 60 lines; over 300 is too much. When a node grows, split it into child
nodes or skills. When an agent writes a long post-mortem into a node, cut it to two lines plus a
pointer to the detail.

## The upkeep loop

1. Start almost empty. Never paste a CLAUDE.md from the internet.
2. Add a short rule only when an agent makes the **same mistake twice**, in the node nearest the
   code involved.
3. Check the next run followed it. If not, diagnose:
   - ignored the rule → node too long or noisy;
   - asks what the node already says → rephrase;
   - follows it only sometimes → conflicting instructions somewhere;
   - generic output → add a pointer to a real example.
4. Prune after refactors and after each new model release; crutches for older models can hold
   newer ones back.
5. Update the node in the same commit as the code change it describes.

## Decisions (ADRs)

Decisions die in the chat where they were made, and the next agent reopens them. When a
conversation settles an architectural choice, the agent writes an ADR from it:

- `docs/decisions/`, numbered from `0001`, title states what we say no to ("feedback is
  server-checked, never client-checked"), not the topic ("feedback strategy").
- Status: proposed, accepted, superseded or deprecated. Never edit or delete; write a new one that
  supersedes it.
- Only real architectural choices. Not "we use TypeScript", not one per pull request.
- Each ADR names what enforces it (test, lint, CI) or says "none".

## Invariants across surfaces

Use when one rule must hold in several places. Here the surfaces are the web page, the voice relay,
the feedback endpoint, the Stripe webhook and the database functions. Write the rule as one
testable sentence, then for each surface: what it forces, what it forbids, and anything that breaks
it now. Do not soften the rule to fit a surface; a surface that cannot comply is a finding. Example
already enforced here: "students only ever hear approved cards" (relay, feedback;
`src/test/ppe.test.ts`, `src/test/live-interview.test.ts`).

## Glossary

Use the codebase's own words in prompts (`docs/glossary.md`). At the end of a session where the
agent needed a lot of steering, ask it which of your terms it had to translate, and append them.

## Fresh chats

One chat per distinct task. A small detour is fine; by the third unrelated switch, quality drops
even with room left in the context window.
