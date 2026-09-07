---
name: code-walkthrough
description: Guide a paced, file-by-file review of an unfamiliar or agent-written codebase, fixing small things as you go, keeping a living checklist, and filing the rest as issues. Use when the user wants to inherit, audit, onboard to, or pre-release review a whole codebase at their own pace. For one changeset use explain-diff or hunk-walkthrough instead.
---

# Code walkthrough

The user reads every file; you introduce each one, answer what they ask, fix what they flag, and record progress. They set the pace. You never move on until they say so.

## 1. Orient

1. Read `CONTEXT.md`, `AGENTS.md`, `README.md`, and `docs/` for what the project does, its stack, and module boundaries.
2. Map the structure: packages, entry points, test files, CI config, schemas.
3. Create a review branch from the default branch, named `review/<short-description>`.
4. Write `REVIEW.md` at the repo root as the living checklist: one checkbox per file grouped by package, in the review order below, plus a `## Findings` list. This file is the source of truth for progress.
5. Optional handbook: when the codebase is large enough that the user wants a map on a second screen, build one with `/visual-explainer` covering module map, data flow, per-package file tables with review priority, test distribution, and a recommended order. Skip it for small repos.

**Complete when:** `REVIEW.md` lists every file to be reviewed and the review branch is checked out.

## 2. Review order

Lowest-dependency package first, then outward:

1. Types and schemas, the vocabulary everything else speaks
2. Pure business logic: rules, validators, scorers
3. Core engine or domain logic
4. Integration layer: API routes, state management, adapters
5. UI, last because it depends on everything above
6. Tests alongside the code they test, never as a separate pass
7. Dev tooling and scripts, skimmed

Within a package: barrel file, types, core logic, helpers.

## 3. Walk each file

1. Introduce it in one line: what it does and where it is used.
2. Open it and stop. The user reads. Answer questions when asked; volunteer nothing.
3. When the user flags something, act by size:
   - **Quick fix** (deprecated API, duplicate constant, missing type, dead code): fix now across every instance in the repo, run typecheck and tests, commit.
   - **Refactor** (split a large function, extract a file, tighten a cast at its source): do it keeping the same tests passing, commit.
   - **Design concern** (wrong abstraction, missing feature, risky pre-release change): open a GitHub issue with the problem, a code reference, the proposed fix, and the review branch it came from. Note the issue number in `REVIEW.md`.
   - **Cosmetic and not worth it**: note in `REVIEW.md`, move on.
4. When the user says next, lgtm, or continue: tick the file in `REVIEW.md` with a one-line summary of findings, then introduce the next file.

Every commit is one fix or one refactor with a conventional-commit subject and explicit file paths staged. Typecheck and tests pass before every commit. Push regularly.

**Complete when:** every file in `REVIEW.md` is ticked by the user, all fixes are committed and pushed, and every deferred finding has an issue number or a note.

## 4. Close out

Run the full test suite once. Summarize in `REVIEW.md`: files reviewed, commits made, issues opened, and anything the user chose to leave. If a handbook exists, update its progress section. Offer `/apr` for the review branch.

## Keeping formatting out of the diff

When linting or formatting setup is part of the review, add the tooling and run it on the default branch as separate commits first, then rebase the review branch onto it. The review PR then carries only logic changes.
