---
name: review-ready
description: Use before declaring any code, test, workflow or agent-instruction change complete, in preflight before implementing one, or when the user asks for the review-ready gate. Checks the change against a design contract (readable entry points, deep modules, real seams, tests through the interface, no comment noise) and writes the gate report.
---

# Review-ready gate

Run this gate before handing back a code change. The change is ready when the report below is complete and every concrete violation is fixed in the changed scope or recorded as an exception in the PR description. The rules live in the contract.

## Load the contract

Use the first contract that exists:

1. A contract the task names, or one that the repo's `AGENTS.md` or `CLAUDE.md` points to.
2. In the repo: `docs/agents/code-quality.md`, `docs/code-quality.md`, `.agents/code-quality.md` or `CONTRACT.md`.
3. [contract.md](contract.md), next to this file.

Read it completely. Find the changed seam from the task and `git diff --name-only`. When the diff falls outside the contract's "When it applies" section, report that the gate does not apply, say why, and stop.

Complete when you know the contract path and the changed seam, or have reported why the gate does not apply.

## Preflight

Run this before implementing, while the change is still taking shape. Write this note, then implement with it in view and within the contract's scope:

```md
Preflight:
- Changed seam: <the behaviour boundary the change moves>
- Entry point: <the file, handler, command or workflow a reader follows top to bottom>
- Owner: <the module that owns new types, policy, lifecycle, validation and errors>
- Test seam: <the caller-facing interface the tests exercise>
```

## Final gate

Run this after implementing and before the final response. Follow the contract's gate section in order, including its timing, verification, simplification and exception rules. Then include this report:

```md
Review-ready gate:
- Contract: <path>
- Changed seam:
- Trace: <the input traced, and what the entry point showed>
- Four tests: <one line per test the contract names>
- Simplification pass: <what was removed, with comment lines cut and kept>
- Verification: <each command and its result>
- Exceptions: <None, or a pointer to the PR-description entry>
```

Complete when the report is filled in and every concrete violation is fixed or recorded as an exception.
