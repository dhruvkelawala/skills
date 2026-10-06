---
name: pr-review
description: Review a pull request, a stack, or the PRs waiting on the user, one PR at a time. Each PR gets a triage of what to read and what to skip, a plain explanation with a code trace, findings with a suggested verdict, and one batched set of comments. Use when the user invokes /pr-review, asks to review or walk through a PR, a stack or a diff before approving, or asks what to review next.
compatibility: Requires git and gh. Inside Herdr it also uses herdr, hunk and node.
---

# PR review

Make reviews fast without losing understanding. You read everything. The user reads the parts that matter, decides, and moves on.

Invoke as `/pr-review [<PR> | <PR in a stack> | <base>..<head> | queue] [--deep] [split]`.

| Argument | What it reviews |
| --- | --- |
| none | The current branch's PR, or the branch changes when there is no PR |
| a PR in a stack | The whole stack, bottom up |
| `queue` | Every open PR waiting on the user: `gh search prs --review-requested=@me --state open`. If the `ship` skill is installed, take the order from `ship queue` instead. |

- `--deep` writes a stop for every READ file instead of only the risky ones. Use it for an unfamiliar area, or when the user says they are new to it.
- `split` makes Herdr open Hunk in a 50/50 split instead of a new tab.

## 1. Pin each PR

For each PR, read `gh pr view <n> --json number,url,title,author,body,baseRefName,baseRefOid,headRefOid,additions,deletions,changedFiles,commits`. Then fetch the base and `refs/pull/<n>/head`, and pin both commits:

```bash
git fetch origin <baseRefName> refs/pull/<n>/head
git update-ref refs/pr-review/<n>-base <baseRefOid>
git update-ref refs/pr-review/<n>-head <headRefOid>
```

Review the range `refs/pr-review/<n>-base...refs/pr-review/<n>-head`. For a plain range, resolve both ends to commit IDs the same way.

Then give each PR a read-only checkout of its head, so every link in the walkthrough opens a real local file in the host's editor:

```bash
dir="$HOME/.agent/pr-review/<repo>/<n>"            # <repo> is the repository's name
git worktree add --detach "$dir" refs/pr-review/<n>-head 2>/dev/null \
  || git -C "$dir" checkout --detach refs/pr-review/<n>-head
```

Read the head side from that checkout and the base side with `git show`. Make no edits or commits there, and leave the user's own checkout on its branch. When the PR's head is already checked out in the current checkout, use that instead.

If `refs/pr-review/<n>-seen` exists and differs from the head, the user has seen an earlier version. Use step 4 for that PR.

**Complete when** every PR in scope has a pinned range and a review checkout at its head, and its file list matches `gh pr view <n> --json files`.

## 2. Triage

Show the triage before any explanation, at most 12 lines per PR:

```text
#523 Thread memory joiner (dhruvkelawala, agent-written)   +612 -88 in 14 files   about 12 min
CI green. Claude reviewed this head. Door: two-way. Ship verdict: none.
Claims: "joins messages sent before the reply". Proof: one screenshot; the parser has tests, the joiner has none.
Review churn: 9 commits after the PR opened, mostly in src/thread/joiner.ts.
READ  src/thread/joiner.ts, src/db/migrations/0042_thread_memory.sql
SKIM  src/thread/format.ts, src/routes/thread.ts, and 3 more
SKIP  pnpm-lock.yaml, 2 snapshots, 1 rename
```

Tag every changed file with exactly one tag:

- **READ** covers authorization, trust boundaries, data writes and migrations, concurrency and retries, money, secrets, production switches and feature flags, prompts and other text a model reads, and any deleted guard or check.
- **SKIP** covers lockfiles, generated files, snapshots, pure renames (`R100` in `git diff -M --name-status`), and fixtures with no logic.
- **SKIM** covers everything else.

Compare what the PR body claims with what it proves. A claimed behaviour backed only by tests is "tests only". For an agent-written PR, add the review churn line: commits made after the PR opened, and the files they touched. That line shows where the time went.

For a stack or a queue, start with one table: order, PR, title, author, size, risk, state (CI, approvals, verdict) and minutes. Risk is high when the PR has a READ file in authorization, data, money or production switches. Order a stack from the bottom. Order a queue so the PR that unblocks the most other PRs comes first, then the smallest. For a stack of more than about five PRs, or a PR over about 2,000 changed lines, offer `/eli25` for an overview page before the walk.

**Complete when** every changed file has one tag and every PR has a time estimate.

## 3. Walk one PR at a time

For the current PR:

1. **What it does.** One short paragraph in plain English: what changes for the user or the developer, and why. Use a real example with real names and values.
2. **How it works.** One real input traced through the changed code, one line per step, each with `path:line`. Follow `/how`'s approach and keep it under 12 lines.
3. **Stops.** One note per risky place in the READ files. Aim for about one stop per 150 changed lines of non-test code, with at least 3 and at most 15. With `--deep`, give every READ file at least one stop.
   - Each stop gives `path:line`, what happens there, and what to check, written as "check X, expect Y".
   - Where a wrong assumption would cause a bug, add "Assumption to challenge:" and the assumption.
   - Many short stops beat a few long ones.
   - List SKIM files at the end, one line each.
4. **Findings.** What you found yourself, each with a severity (P0 to P3) and `path:line`. Look for:
   - bugs, and behaviour that does not match the claim
   - more parts than the job needs
   - hand-written code where the repo already has a helper or a library
   - long agent-written comments
   - changes outside the PR's purpose
5. **Suggested verdict.** One line with the reason. Choose one of:
   - approve
   - approve with "please fix before <flag> is enabled", for features shipped behind a switch
   - request changes, only for a P0 or P1 or a change to production authority

Deliver the stops where the user reads diffs:

- **Inside Herdr** (`test "${HERDR_ENV:-}" = 1`), attach them as numbered Hunk notes too, following [references/hunk.md](references/hunk.md).
- **Everywhere else,** the chat message is the walkthrough. Write every code reference, in the trace, the stops, the findings and the triage, as a Markdown link to the file in the review checkout, with the line after a colon: `[fire.ts:118](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/fire.ts:118)`. T3 Code, Codex and Claude Code open these links in their own editor. A bare path is not clickable in every host and a GitHub link leaves the host, so code links always point at the local checkout. For a line range, link the first line and put the range in the label.

Show progress with each PR ("3 of 6"), then wait for the user's word:

| Word | What you do |
| --- | --- |
| `next` or `approve` | Record the decision, run `git update-ref refs/pr-review/<n>-seen <head>`, and start the next PR |
| `approve and post` | Post as in step 5, then do the same as `next` |
| `how` | Go deeper on this PR with the full `/how` trace or `/explain-diff` |
| any comment | Add it to the ledger for this PR |
| `stop` | Finish with the report |

**Complete for a PR when** the user has given their word and the `seen` ref points at the head they reviewed.

## 4. Return visits

When a PR's head has moved since `refs/pr-review/<n>-seen`, move its review checkout to the new head as in step 1, then show only what changed since the user last looked:

- If the branch was rebased, use `git range-diff <old base>..<seen> <base>..<head>`.
- Otherwise, use `git diff <seen>..<head>`.

Triage and walk only that change, and say which earlier findings it fixes.

**Complete when** every change since the `seen` ref has a tag, and every earlier finding is marked fixed or still open.

## 5. Comments

Keep one ledger per PR. Collect from:

- The user's comments in chat.
- Their Hunk notes: `hunk session comment list <session> --type all`. Without `--type all` you only see your own notes.
- Review comments they left in the host's diff view.
- Existing GitHub threads, so nothing is said twice.

What happens next depends on whose PR it is:

- **The user's own PR** (the PR author equals `gh api user --jq .login`). Each item becomes a fix for the agent that owns the branch, or for you when they ask. Nothing is posted.
- **Someone else's PR.** Draft one review: a short body plus inline comments anchored on added lines.
  - Write like the user: short and direct, with "Nit:", "Non-blocking:" and "Please fix before X is enabled" where they fit.
  - Show the draft, and post only when they say post: `gh api repos/<owner>/<repo>/pulls/<n>/reviews`, with `commit_id` set to the reviewed head and the event they chose (COMMENT, APPROVE or REQUEST_CHANGES).

Post, approve or request changes only on the user's explicit word for that PR.

**Complete when** every ledger item is fixed, posted, or dropped by the user.

## Report

First remove the review checkouts of PRs that were approved, merged or closed: `git worktree remove "$HOME/.agent/pr-review/<repo>/<n>"`. Keep the checkout of a PR still waiting on changes, for the return visit.


- For each PR: the decision, the posted review URL or "not posted", and the findings still open.
- For a stack or a queue: how many PRs are done, and what is left.
