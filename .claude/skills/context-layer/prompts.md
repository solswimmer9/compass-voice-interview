# Course prompts (Agentic Coding School, cohort 3)

## Docs snippet for AGENTS.md ("What Goes in the Docs Folder")

```
# Docs

- `docs/architecture/` is what is true now. One note per subsystem: invariants, the surface table, the test that guards each. Read the note for the area you touch. Edit it in place.
- `docs/decisions/` is why. Numbered ADRs. Never edit one, supersede it.
```

## Glossary ("Glossaries for Better Prompts")

```
Using 5 explore subagents, analyze this codebase to help me communicate more effectively with you in future prompts. I want you to:

1. **Scan the project structure** - Look through all directories, modules, and files to understand the architecture.

2. **Identify key terminology** including:
   - Domain-specific terms unique to this project
   - Custom class names, function names, and module names that I should reference by their exact names
   - Any internal naming conventions or patterns (e.g., if handlers are called "processors", services called "managers", etc.)
   - Abbreviations or acronyms used in the code and what they mean
   - Key abstractions or concepts the codebase is built around

3. **Map out the agent/sub-agent architecture** (if applicable):
   - What are the different agents or components called?
   - How do they interact?
   - What terminology does the code use to describe their relationships?

4. **Note any project-specific jargon** in comments, docstrings, or documentation files.

5. **Create a glossary** formatted as:
   - Term → What it means → When I should use it in prompts to you

Focus on terms that would help me give you precise instructions. For example, if I should say "create a new Handler" rather than "create a new processor" because that's what this codebase calls them, I need to know that.

Output a reference document I can keep and use when prompting you about this codebase.
```

## Implementation notes ("Implementation Notes & Decision Boards")

```
Implement <SPEC>. As you work maintain a running implementation-notes.html file that captures anything I should know about how the implementation diverges from or interprets the spec, including:

- Design decisions: choices you made where the spec was ambiguous
- Deviations: places where you intentionally departed from the spec, and why
- Tradeoffs:  alternatives you considered and why you picked what you did
- Open questions: anything you'd want me to confirm or revise
```

## Invariant across surfaces ("Writing Invariants Across Surfaces"; close to his wording)

```
Invariant: <one testable sentence>.
Surfaces: <web page, voice relay, feedback endpoint, Stripe webhook, database functions>.
For each surface, write down what the rule forces us to do there, what it forbids there, anything in the current code or prototype that breaks it. If the surface cannot satisfy the rule, say so and why. Don't soften the rule to make the surface fit. If the surface cannot satisfy it, that is a finding.
```
