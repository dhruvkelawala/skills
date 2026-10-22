---
name: explain-diff
description: Explain a diff, commit, branch, range or PR in chat, opening with a before-and-after sketch, then in plain words the problem, the one key idea, and one real input traced through the changed code. Use when the user asks to explain a change, asks what a change does, or says they don't understand it, and when pr-review needs a deeper look at one PR.
---

# Explain a diff

Explain a change so it lands on the first read: a sketch of what changed, then plain words and one real example traced through the code. Group by idea, never by walking files from top to bottom.

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

Read the changed files themselves, their callers and their tests, not just the hunks. For a PR that isn't checked out, run `git fetch <remote> pull/<n>/head` and read each file with `git show FETCH_HEAD:<path>`, without making a checkout. Find the reason for the change in the linked issue, the PR body or the commit message. When the reason comes only from reading the code, say it is inferred.

**Complete when** both ends of the comparison are pinned, and every claim you plan to make has a file and line behind it.

## 2. Explain

Write it in this order, with about 400 words of prose after the sketch:

1. **The sketch.** A small drawing of the change, before and after, in a fenced `text` block, ahead of any prose: boxes and arrows for a flow, a call tree, a file tree, or the code's shape with `-` and `+` lines. Keep it to about 12 lines under 40 characters, so it reads on a phone.
2. **The problem.** One or two sentences, no code.
3. **The key idea.** The one thing that makes the change click: a method, a flag, an inversion.
4. **The trace.** One realistic input followed through the changed code. Write one line per step, each with `path:line`. Add one edge value when it changes the outcome.
5. **Not in this change.** One line, when the change leaves something out on purpose.

Add a section only when the change has something for it:

- **The parts.** Two to four named pieces, when there are several.
- **Hidden machinery.** Framework behaviour, generated code or storage a newcomer would not guess.
- **What the tests promise.** Each test restated as a promise. Say which tests you read and which you ran.

Stop after the last section, with no menu of follow-up choices. When the reader says they still don't follow, load `../eli25/SKILL.md` and make its short page on the same change as the next try.

Run `../unslop/SKILL.md` on the explanation last. Keep the order and length above, and leave quoted text and code as they are.

## Style

- Plain English: short active sentences, real names and values, and a short gloss on any term the reader may not know, at first use.
- Use the repository's own names for things; read `CONTEXT.md` when it exists.
- Every link opens in T3, so it works from a phone too. Write each trace step as a Markdown link with a repo-relative path, such as `[store.ts:31](src/intake/store.ts:31)`, which T3 opens in its file panel at that line. Name a PR by its GitHub URL, which T3 opens in its PR panel on the diff. Never write an absolute path, a `file://` URL, `localhost`, or a link to a file on GitHub.
- A file link opens whatever the thread's checkout holds, so link a step only when the checkout is at the explained revision. For a PR that isn't checked out, or an older commit, link the PR in the problem line and give each step's file and line as plain text outside backticks, because T3 turns a code-formatted path into a file link too.

Example:

> ```text
> POST /intake {weirdField: 123}
>   schema.ts
> -   strict: drops weirdField
> +   .passthrough(): keeps it
>   store.ts: saves it
>   load.ts: reads it back
> ```
>
> **Problem:** Each source sends a different format, and we need one internal shape that never drops a field.
> **Key idea:** `.passthrough()` keeps unknown fields instead of deleting them.
> **Trace:** `POST /intake {..., weirdField: 123}` is checked by [schema.ts:14](src/intake/schema.ts:14), stored by [store.ts:31](src/intake/store.ts:31), and read back after a restart by [load.ts:9](src/intake/load.ts:9) with `weirdField` still present.
