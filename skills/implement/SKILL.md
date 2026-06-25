---
name: implement
description: Implement a single GitHub issue or Linear ticket as a small, reviewable vertical slice. Use when the user invokes /implement, asks to implement an issue/ticket, or passes a PRD plus one agent-ready issue from /to-issues or /triage.
---

# Implement

Implement one agent-ready work item in small, reviewable chunks.

This is the build step in the `/ask-matt` idea-to-ship flow. It usually receives a single issue from `/to-issues`, a `ready-for-agent` issue from `/triage`, a Linear ticket, or a PRD/handoff plus exactly one issue to implement.

## Contract

- Work one issue or ticket at a time.
- Treat the issue body, linked PRD, plan, and acceptance criteria as the source of truth.
- If the work item is too broad for one reviewable PR, stop and propose a split instead of silently doing a sprawling implementation.
- Keep changes scoped to the ticket. Preserve unrelated dirty files.
- From `main`, `master`, or the default branch, create `{type}/{short-description}` where `{type}` is a conventional commit type such as `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, or `ci`.
- Commit each implementation round as its own conventional-commit commit before starting the next round.
- Never force-push ordinary changes. Force-push only after a rebase requires updating remote history, and use `--force-with-lease`, not `--force`.
- Implement as vertical slices: each chunk should move real behavior end-to-end, not just one horizontal layer.
- Verify with focused tests first, then broader checks when the blast radius justifies it.
- Run structured autoreview at the end of each implementation round, using a different engine family from the model that wrote the code.
- If running as a Pi agent or inside the Pi harness, run `hunk skill path`, read the printed Hunk review skill, and use Hunk AI notes to walk through the changeset.
- Do not publish, close, or relabel the issue unless the user asks, or they invoke a publish flow such as `/apr`.

## Workflow

### 1. Resolve the work item

Read the full issue or ticket: title, body, comments, labels/status, acceptance criteria, linked PRD/plan/ADR/handoff/parent issue, and any blockers. For GitHub, use the GitHub app when available, otherwise `gh`. For Linear, use the Linear app when available. If the user passes a PRD plus an issue, read both, but implement only the single issue.

### 2. Establish repo state

Inspect the repository before editing: `git status -sb`, current branch/default branch, remotes, dirty files, and relevant docs such as `CONTEXT.md`, ADRs, plans, or domain glossary. If on `main`, `master`, or the default branch, sync the base branch and create a `{type}/{short-description}` branch, for example `feat/add-billing-export` or `fix/handle-empty-import-rows`. If already on a feature branch, stay there unless the user asked for a new branch. Never revert unrelated user changes.

### 3. Check readiness

Before coding, confirm the issue is implementable:

- acceptance criteria are clear enough
- blockers are not still open
- the requested behavior is not already implemented
- the codebase has an obvious place for the change

If it is not ready, say why and ask the smallest necessary question. If the issue is raw or under-specified, recommend `/triage` or `/grill-with-docs` rather than guessing.

### 4. Make a chunk plan

Create a short checklist of reviewable chunks. Each chunk should be small enough to inspect, but complete enough to compile and test. Prefer this shape:

1. Update or add the narrow regression test.
2. Implement the smallest code path that satisfies it.
3. Wire the behavior through the real integration point.
4. Run focused verification and structured autoreview.
5. Fix accepted findings, then rerun focused verification and review.
6. Commit the round with a conventional-commit subject.
7. Repeat for the next acceptance criterion.

Do not over-plan. Once the chunks are clear, start implementing.

### 5. Implement

Work through the chunks in order. While editing:

- follow existing repo patterns
- keep abstractions local unless the codebase already has a shared pattern
- keep naming aligned with the domain model
- update docs or plan trackers only when the repo convention or issue asks for it
- avoid opportunistic refactors outside the ticket

If live code has drifted from the issue or plan, compare against current behavior and adapt narrowly. If the drift changes the product decision, pause and explain the tradeoff.

### 6. Verify and review

Run the smallest meaningful checks first: focused unit/integration tests, typecheck/lint/format when relevant, app or browser-visible verification for user-facing UI changes, and regression commands named in the issue, PRD, or repo docs. If a command cannot run because of missing env, dependencies, or external services, report that as a verification limit and still run any deterministic local checks available.

After each implementation round, run `/autoreview`. Use an explicit review engine different from the code-writing model family:

- If the implementor is Codex, GPT, or another OpenAI model, use `--engine claude --model claude-opus-4-8`.
- If the implementor is Claude or another Anthropic model, use `--engine codex`.
- If the implementor is unknown or the model family is unclear, fall back to `--engine claude --model claude-opus-4-8`.

If the Claude engine is not installed, unavailable, or exits with an engine/tooling error before producing a usable review, rerun autoreview with `--engine codex` and report the fallback in the closeout. Do not use Codex as a fallback for ordinary Claude review findings; only fall back when the Claude review cannot run.

Treat review findings as advisory: verify each accepted finding against the real code, fix accepted actionable issues, rerun focused tests, and rerun autoreview until it is clean or a remaining finding is consciously rejected.

### 7. Close out

End with a concise implementation report:

- branch name, changed behavior, and important files touched
- tests/checks run, plus autoreview command, engine, and result
- Hunk AI-note walkthrough status when running in Pi
- skipped checks, remaining risks, follow-up work, and whether the ticket appears fully satisfied

If the user wants review and publish, hand off naturally to `/apr`.
