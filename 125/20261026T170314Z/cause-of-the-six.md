# Why six merged worktrees with nothing to keep were never removed (#125)

A read-only look at the project the issue describes, on 2026-10-26. The project is private, so this
gives counts and kinds only. It was read with `git worktree list`, `git ls-remote`, `git ls-files
--others --ignored --exclude-standard --directory`, `gh pr list --state all`, and `t3 thread show
--json` for every thread in the project, subagents included (884 threads).

## What the worktrees are

| | count |
| --- | --- |
| worktrees in the project | 124 |
| whose branch is not on origin | 83 (the issue counted 81; two are newer) |
| of those, a PR's own head branch | 6 (5 merged, 1 open) |
| of those, a local branch never pushed (`review/...`, `test/verify-pr-...`, `chore/review-...`) | 77 |
| of the 77, made by a delegated child thread (code-review reviewers, `ship verify` agents, review prep) | 64 |
| of the 77, made by a top-level thread (spikes, research, a review sitting and others) | 12 |
| made by hand with `git worktree add`, with no T3 thread | 4 (3 PR branches, 1 other) |

"Made by" is the earliest thread whose worktree it is, from `t3 thread show --json`.

`after-merge.mjs` removes only the worktree that holds the merged PR's own branch, run from the
thread that owns the PR. So it could only ever reach 6 of the 83.

## The six with no changes and no ignored files

| # | what made it | branch | its PR |
| --- | --- | --- | --- |
| 1 | a code-review reviewer (spec, pass 1) that an issue-to-pr build started with `delegate_task` in a worktree of its own | local `review/...`, never pushed | still open; the worktree's commit is in it |
| 2 | the same build's standards reviewer, pass 1 | local `review/...` | the same open PR |
| 3 | the same build's spec reviewer, pass 2 | local `review/...` | the same open PR |
| 4 | a `ship verify` agent, started with `delegate_task` in a worktree of its own | local `review/...` | merged; the worktree is at an earlier head of it |
| 5 | a `/pr-review` queue sitting, in its own T3 worktree | local `chore/...`, never pushed | none of its own; it reviewed 9 PRs, all merged |
| 6 | `git worktree add` into a sibling folder, by a session outside T3, 18 seconds before the PR opened | the PR's own branch | merged; no thread ever linked it |

The issue guessed that these PRs merged after their thread stopped watching. That holds for none of
them:

- **1 to 5 never held a PR's branch.** They are worktrees of delegated children and of a review
  sitting. `delegate_task` with `isolation: "worktree"` makes "a new prepared checkout from the
  parent commit", and nothing removes it when the child ends. No skill in this repo asks for that
  isolation by name: issue-to-pr's stage 3 and `ship verify` say only "delegate_task", and the
  parent chose the worktree.
- **6 had no owning thread.** No T3 thread held its worktree or linked its PR. When the PR merged,
  the user said "Merged" in a different thread, which didn't own the PR and ran no cleanup.

So changing when after-merge runs would have removed none of the six.

## The ignored files the issue counted

| | count |
| --- | --- |
| hold a `.env.local` link to the main checkout | 72 |
| hold `.husky/_/` | 75 |
| hold only links out and `.husky/_/` (beside `node_modules`) | 6 |
| also hold build output outside `REBUILDABLE`: `.output/`, `dist/`, `test-results/`, `coverage/`, `tsconfig.tsbuildinfo`, `next-env.d.ts` | 64 |

Of the 5 merged PR worktrees, this change lets after-merge remove 1. Three stay for build output
outside `REBUILDABLE`, and the sixth case above had nothing to keep.
