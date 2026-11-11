---
id: NNNN
title: <what we are saying no to, in one line>
status: proposed # proposed | accepted | superseded | deprecated
date: YYYY-MM-DD
deciders: [<who made the call>]
supersedes: null
superseded_by: null
touches: [] # paths this decision governs, e.g. [src/lib/live-relay.server.ts]
enforced_by: none # none | test | lint | ci
---

# NNNN. <what we are saying no to>

## Context

The situation that forces a choice now: constraints, pressure, what cannot change. Facts only.

## Options

- **A: <name>.** For: … Against: …
- **B: <name>.** For: … Against: …

Every real option has a downside; if one does not, the list is incomplete.

## Decision

We will <do X>, because <reason tied to the context>. The trade-off we accept: <…>.

## Consequences

What gets easier, what gets harder, what must now be maintained.

## Enforcement

The test, lint rule or CI job that stops this quietly reversing, by file name. If none, say so and
what would.

## Revisit if

The threshold, broken assumption or date that would reopen this.
