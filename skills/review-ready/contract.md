# Code quality contract

This is the default contract for the `review-ready` gate. A project contract, such as `docs/agents/code-quality.md`, replaces it.

## When it applies

Apply this contract to production code, tests, workflows, agent instructions, request handlers, CLI commands, migrations, integration adapters and any other change to how the system behaves. Apply it to the seam you are changing. Leave unrelated cleanup for a separate issue unless the change cannot be made safely without it.

## Design standard

A review-ready change makes the changed flow easier to follow through its public shape. A smaller diff alone does not meet the standard.

- Entry points read as the domain flow. A handler, workflow or command reads top to bottom as the story of what happens. Parsing, policy, resource setup, persistence and provider details sit behind named modules that own them.
- Modules are deep and own their concepts. A module hides cohesive behaviour behind a small interface. Domain types, errors, constants, validation and lifecycle rules live beside the behaviour that owns them. Generic runners and utilities own only generic concepts.
- Seams are real. Add an interface or adapter only where behaviour varies, or where a policy or effect boundary needs replacing in tests. A wrapper that only renames another interface adds no depth. Dependencies point from orchestration toward the owning modules, with no cycles.
- Tests go through the interface. Test observable behaviour and safety invariants through the interface that callers use. Test an internal helper only when the interface cannot reach the condition deterministically. Test a declarative registration or configuration as source when the declaration is the only observable seam.
- Improvement stays local. Deepen the changed seam and keep the scope small. A security check that must run when an effect happens stays visible in the module that performs the effect, even when extracting it would look tidier.

## Review-ready gate

Run this gate before declaring implementation complete:

1. After the tests pass, re-read every changed file top to bottom.
2. Trace one representative input through the changed flow and confirm the entry point still tells that story.
3. Apply the four tests:
   - Caller knowledge. What must each caller know to use the changed module correctly, and can that knowledge move behind the interface?
   - Deletion. If the module vanished, would its complexity disappear or spread back across callers?
   - Ownership. Does every new concept have one clear home beside the behaviour that owns it?
   - Test seam. Do the tests exercise the interface rather than the wiring behind it?
4. Make one simplification pass inside the changed scope. Remove duplicated policy, speculative configuration, pass-through abstractions, temporary compatibility code and interface that no caller needs. Then check every comment the change adds or touches:
   - Keep license headers, a one- or two-line doc comment that defines a public API, a link that explains an external constraint (an issue, an RFC or a vendor doc), and every `ponytail:` comment. A `ponytail:` comment names a deliberate shortcut, its limit and when to upgrade it, and stays as written.
   - Delete comments that narrate what the code does, banner and divider comments, and commented-out code.
   - When a comment states a constraint, such as "do not remove" or "must run before X", turn it into a type, a test or a lint rule where one can hold it, then delete the comment. Keep the comment only when nothing can enforce the constraint.
   - Move longer reasoning to the PR description.
5. Run every verification command the repository defines. Report failures and skipped checks as they are. Explain each intentional exception to this contract in the PR description.

The work is review-ready once no concrete violation remains unresolved.

## Scope limits

Judge a change by depth, ownership, locality and testability. This contract sets no limit on file length, function length, complexity, module count or coverage, and a large file can be fine. Extract or split code only when that makes a module deeper, gives a concept one owner, or makes a seam testable. Leave repo-wide cleanup that is unrelated to the change for another issue.
