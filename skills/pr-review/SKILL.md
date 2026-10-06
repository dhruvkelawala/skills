---
name: pr-review
description: Review a pull request, a stack, or the PRs waiting on the user, one PR at a time. Each PR gets the few architecture and system-design changes worth judging, each with a before-and-after sketch and the question to answer, then findings, a suggested verdict and one batched set of comments. Implementation detail comes only on request. Use when the user invokes /pr-review, asks to review or walk through a PR, a stack or a diff before approving, or asks what to review next.
compatibility: Requires git and gh. Inside Herdr it also uses herdr, hunk and node.
---

# PR review

Make reviews fast without losing understanding. You read everything, implementation included. The user sees the design: what changed in how the system fits together, and what they have to decide about it.

Invoke as `/pr-review [<PR> | <PR in a stack> | <base>..<head> | queue] [--deep] [split]`.

| Argument | What it reviews |
| --- | --- |
| none | The current branch's PR, or the branch changes when there is no PR |
| a PR in a stack | The whole stack, bottom up |
| `queue` | Every open PR waiting on the user: `gh search prs --review-requested=@me --state open`. If the `ship` skill is installed, take the order from `ship queue` instead. |

- `--deep` adds the implementation layer to every PR: a code trace and line-level stops. Use it for an unfamiliar area, or when the user says they are new to it.
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

Show the triage before any explanation, at most 6 lines per PR:

```text
#540 Reminders fire as real Slack deliveries (vladutjs)   +1904 -153 in 19 files   about 10 min
CI green. No approvals. Door: none, so treat it as one-way. Ship verdict: none.
Claims: "a fire takes the same path as a human mention". Proof: tests only.
Design lives in: fire.ts, store.ts, the 0042 migration. The other 16 files carry it out.
```

Read the whole diff first, then name the few files where a design decision is made (step 3 lists what counts). Everything else is implementation, and the triage only counts it. Lockfiles, generated files, snapshots and pure renames (`R100` in `git diff -M --name-status`) never count as design.

Compare what the PR body claims with what it proves. A claimed behaviour backed only by tests is "tests only". For an agent-written PR, add one line on review churn: commits made after the PR opened, and the files they touched. That line shows where the time went.

For a stack or a queue, start with one table: order, PR, title, author, size, risk, state (CI, approvals, verdict) and minutes. Risk is high when a design change touches authority, data, money or a production switch. Order a stack from the bottom. Order a queue so the PR that unblocks the most other PRs comes first, then the smallest. For a stack of more than about five PRs, or a PR over about 2,000 changed lines, offer `/eli25` for an overview page before the walk.

**Complete when** every PR has its design files named and a time estimate.

## 3. Walk one PR at a time

Show the design, not the implementation. A **design change** changes how the parts of the system fit together or what the system promises. Look for these, roughly in this order of importance:

- **Authority:** who may do what, as which identity, and where that is checked.
- **Data:** new or changed tables, columns, keys, indexes and migrations, and what is kept for how long.
- **Ownership:** which component now owns a piece of state, a process or a decision, and what moved.
- **Contracts:** APIs, events, protocols, message shapes, config keys and flags that other parts or other teams rely on.
- **Flow and timing:** new processes, queues, schedulers or loops, and their ordering, idempotency, retries and concurrency.
- **Failure:** what happens when a dependency is down or a step half-completes, and how it recovers.
- **Dependencies:** new external services or packages, and which way modules now depend on each other.
- **Rollout:** production switches, defaults, and changes that cannot be undone.

Everything else is implementation: how a function does its job, helper refactors, naming, log and error text, and test scaffolding. Leave it out unless it breaks a promise a design change makes.

For the current PR:

1. **What it does.** One short paragraph in plain English: what changes for the user or the developer, and why. Use a real example with real names and values.
2. **Design changes.** Usually two to five, most important first. For each:
   - the decision as one claim, such as "A reminder fires as the person who set it."
   - a small before-and-after sketch. Call the Skill tool with `show-me` and use its smallest view that shows the change: a call tree or flow with `+` and `-` lines, a sequence diagram for messages between parts, a file tree for moved ownership, or a table shape for data. When one change is too dense for a code block, such as a new subsystem or a UI flow, let show-me write one focused HTML diagram and link it. Without show-me installed, pick from the same views yourself.
   - why it matters, in one or two sentences: what it constrains, couples or risks, or what makes it hard to undo
   - **Judge:** the one question the user must answer to accept it
   - one link to where the decision is made

   When a PR has no design change, such as a contained bug fix or a refactor inside one module, say so in one line and go to the findings.
3. **Findings.** Only P0 and P1 problems and design-level concerns: a wrong owner, a missing seam, more parts than the job needs, or a promise the code does not keep. Give each a severity and a link. End with one line that counts the rest, such as "4 smaller findings; say `what else` to see them".
4. **Suggested verdict.** One line with the reason. Choose one of:
   - approve
   - approve with "please fix before <flag> is enabled", for features shipped behind a switch
   - request changes, only for a P0 or P1, or a change to production authority

Keep the default under about 500 words per PR. A design change reads like this:

````md
**1. A reminder fires as the person who set it.**
```diff
 reminder tick
-  post the reminder text as the bot
+  claim a Slack event as the requester
+    recheck membership, slack:reply and channel audience
+    run Mario with read tools and the reply tool
```
Reminders now carry the requester's authority days after they were set, rechecked on every attempt instead of once at creation.
**Judge:** should a reminder act as its requester, or as the bot? [fire.ts:351](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/fire.ts:351)
````

**The implementation layer.** With `--deep`, or when the user says `deeper`, add for this PR:
- one real input traced through the changed code, one line per step with a link, following `/how` and under 12 lines
- line-level stops in the risky files, about one per 150 changed lines of non-test code, with at least 3 and at most 15. Each stop links its line and says what to check as "check X, expect Y", plus "Assumption to challenge:" where a wrong assumption would cause a bug.

Deliver the review where the user reads diffs:

- **Inside Herdr** (`test "${HERDR_ENV:-}" = 1`), also attach one numbered Hunk note per design change at the line where it is decided, plus the line stops when the implementation layer is shown, following [references/hunk.md](references/hunk.md).
- **Everywhere else,** the chat message is the walkthrough. Write every code reference, in the design changes, the findings, the trace and the stops, as a Markdown link to the file in the review checkout, with the line after a colon: `[fire.ts:118](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/fire.ts:118)`. T3 Code, Codex and Claude Code open these links in their own editor. A bare path is not clickable in every host and a GitHub link leaves the host, so code links always point at the local checkout. For a line range, link the first line and put the range in the label.

Show progress with each PR ("3 of 6"), then wait for the user's word:

| Word | What you do |
| --- | --- |
| `next` or `approve` | Record the decision, run `git update-ref refs/pr-review/<n>-seen <head>`, and start the next PR |
| `approve and post` | Post as in step 5, then do the same as `next` |
| `deeper` | Add the implementation layer for this PR: the trace and line stops |
| `what else` | List the smaller findings that were only counted |
| `how` | Explain one part in full with `/how`, or the whole change with `/explain-diff` |
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
