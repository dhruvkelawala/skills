---
name: build
description: Implement one GitHub issue, Linear ticket, conversation plan, or confirmed contract as test-first vertical slices on a branch cut from a pinned base, one commit per slice, with no review inside the loop. Use when the user invokes /build, /build plan, asks to implement an issue or ticket, or when /issue-to-pr hands over a confirmed contract for its implementation stage.
---

# Build

Turn one work item into committed, tested slices. Build implements; it does not review or publish. Review belongs to `/code-review`, verification to `/verify`, publishing to `/apr`. Keeping those out of the loop is what makes build's output a clean diff from one pinned base.

Invoke as `/build <issue number|URL|ticket>`, `/build plan` for the plan just made in conversation, or hand build a contract block (below). A contract skips step 1 entirely, including its confirmation: the caller has already settled scope, and build asks nothing. It reports blockers instead of asking questions.

## 1. Pin the contract

Standalone only. Produce the same contract block `/issue-to-pr` uses, so both paths implement from one shape.

1. Read the full work item: title, body, comments, acceptance criteria, linked PRD, plan, ADR, or parent. For GitHub use `gh issue view`; for Linear use the Linear app when available. For `/build plan`, the conversation plan is the work item; if there is none, ask for it.
2. Read enough code to name the public seam the tests will exercise and the paths that will change. When the shape of that seam is itself in question, `/codebase-design` supplies the vocabulary.
3. `git fetch` and pin the base: the remote-tracking ref of the default branch and its SHA. If already on a feature branch with commits, the merge-base with the default branch is the base instead.
4. Write the contract and show it once for confirmation (standalone only; a caller-supplied contract is never re-confirmed):

```md
contract:
  issue: <url or "plan">
  base_sha: <sha>
  branch: <type>/<issue-number>-<short-description>
  in_scope: <paths>
  out_of_scope: <items>
  acceptance_criteria: <list>
  test_seam: <public interface tests exercise>
  verification: <focused command>, <full command>
```

5. If the item is too broad for one reviewable PR, propose the split here instead of implementing a sprawl. If acceptance criteria cannot be stated, say what is missing and ask the one question that unblocks it.
6. Create `branch` from `base_sha` unless it already exists and is checked out.

**Complete when:** the user has confirmed a contract with at least one acceptance criterion, a named seam, and a pinned base SHA, and the branch is checked out.

## 2. Confirm the checkout

`git rev-parse HEAD` must equal `base_sha` or descend from it. The current branch must be `branch`. `git status` must be clean apart from files the contract names. A mismatch is a blocker to report, never something to fix by resetting or stashing another person's work.

## 3. Slice

Work one acceptance criterion at a time, following `/tdd` at `test_seam`:

1. Write one failing test that states the criterion in the project's domain language. Run it and see it fail for the right reason. Keep the failing assertion lines from the runner output; they are the red half of the evidence.
2. Write the smallest code that passes it, at the real integration point, so the slice moves behavior end to end. Keep the passing summary line; that is the green half.
3. Run the focused verification command for the touched paths and the typecheck when the project has one.
4. Commit the slice with a conventional-commit subject. One slice, one commit.
5. Next criterion.

While editing: follow existing repo patterns, keep abstractions local unless a shared pattern already exists, touch only `in_scope` paths, and leave refactoring to review. If a change genuinely needs a path outside scope, stop and report it as a scope blocker with the reason. If live code has drifted from the work item in a way that changes the product decision, stop and explain the tradeoff.

**Complete when:** every acceptance criterion has a committed slice with a test that failed before it and real red and green runner lines kept for the report, or an explicit blocker, and `git status` is clean.

## 4. Verify

Run `/verify` in full mode once, at the final HEAD. On `red`, fix the cause as one more slice and rerun. On `incomplete`, record what could not run and why. Do not run any review here.

## 5. Report

```md
Build report:
- Branch: <name> at <HEAD sha>, base <base_sha>
- Criteria:
  - <criterion>: <test commit sha> → <impl commit sha> / <test name>   (or: BLOCKED — <reason>)
    red:   <failing assertion line(s), trimmed, pasted from the runner>
    green: <passing summary line, pasted>
    reproduce: <exact command from the repo root>
    surface: <web | mobile | desktop | TUI | CLI | API | library>; how to drive it for this criterion, for the caller's evidence capture
- Verification: green | red | incomplete — <one line>
- Scope: <paths touched>; deviations, if any
- Risks and follow-ups:
```

Standalone: hand off with "next: `/code-review <base_sha>`, then `/apr`". In contract mode return the report to the caller and stop. Never publish, merge, close, or relabel the work item.
