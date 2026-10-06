---
name: explain-diff
description: Explain a diff, commit, branch, range or PR in plain words, covering the problem, the one key idea, and one real input traced through the changed code. Use when the user asks to explain a change, asks what a change does, or says they don't understand it, and when pr-review needs a deeper look at one PR.
---

# Explain a diff

Explain a change so it lands on the first read: plain words, one real example traced through the code. Group by idea, never by walking files from top to bottom.

## 1. Get the change

Pick the command that matches what the user means by "the change":

| Target | Command |
| --- | --- |
| Working tree | `git diff` plus `git diff --cached` |
| Commit | `git show <sha>` |
| Branch | `git diff $(git merge-base <default-branch> HEAD)...HEAD` |
| Range | `git diff <from>..<to>` |
| PR | `gh pr view <n>`, then `gh pr diff <n>` |

With no target, explain the uncommitted changes when there are any, otherwise the branch against the default branch.

Read the changed files themselves, their callers and their tests, not just the hunks. Find the reason for the change in the linked issue, the PR body or the commit message. When the reason comes only from reading the code, say it is inferred.

**Complete when** both ends of the comparison are pinned, and every claim you plan to make has a file and line behind it.

## 2. Explain

Write it in this order, under about 400 words:

1. **The problem.** One or two sentences, no code.
2. **The key idea.** The one thing that makes the change click: a method, a flag, an inversion.
3. **The trace.** One realistic input followed through the changed code. Write one line per step, each with `path:line`. Add one edge value when it changes the outcome.
4. **Not in this change.** One line, when the change leaves something out on purpose.

Add a section only when the change has something for it:

- **The parts.** Two to four named pieces, when there are several.
- **Hidden machinery.** Framework behaviour, generated code or storage a newcomer would not guess.
- **What the tests promise.** Each test restated as a promise. Say which tests you read and which you ran.

End with two or three labelled zoom-in choices, and ask which part is still unclear.

## Style

- Plain English: short active sentences, real names and values, and a short gloss on any term the reader may not know, at first use.
- Use the repository's own names for things; read `CONTEXT.md` when it exists.
- Every trace step points at a file and a line.

Example:

> **Problem:** Each source sends a different format, and we need one internal shape that never drops a field.
> **Key idea:** `.passthrough()` keeps unknown fields instead of deleting them.
> **Trace:** `POST /intake {..., weirdField: 123}` is checked by `src/intake/schema.ts:14`, stored by `src/intake/store.ts:31`, and read back after a restart by `src/intake/load.ts:9` with `weirdField` still present.
> **Zoom in?** (a) where the run log is stored (b) why passthrough matters (c) the restart test
