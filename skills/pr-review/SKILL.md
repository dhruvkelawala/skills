---
name: pr-review
description: Review a pull request, a stack, or the PRs waiting on the user, one PR at a time. Each PR gets the few architecture and system-design changes worth judging, each with a before-and-after sketch and the question to answer, then findings, a suggested verdict and one batched set of comments. Implementation detail comes only on request, and `try` runs the PR for hands-on testing. Use when the user invokes /pr-review, asks to review, walk through or test a PR, a stack or a diff before approving, or asks what to review next.
compatibility: Requires git and gh.
---

# PR review

Make reviews fast without losing understanding. You read everything, implementation included, and then walk the user through the PR in one message: an intro, a tour of the whole route, and a wrap-up. The user decides, and nothing reaches GitHub until they say so.

Invoke as `/pr-review [<PR> | <PR in a stack> | <base>..<head> | queue]`.

| Argument | What it reviews |
| --- | --- |
| none | The current branch's PR, or the branch changes when there is no PR |
| a PR in a stack | The whole stack, bottom up |
| `queue` | Every open PR waiting on the user: `gh search prs --review-requested=@me --state open`. If the `ship` skill is installed, take the order from `ship queue` instead. |

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

## 2. Read the PR

Read the whole diff, the PR body, the issue it closes, the CI state, the approvals and the `**Door:**` line. Lockfiles, generated files, snapshots and pure renames (`R100` in `git diff -M --name-status`) carry no design. Compare what the body claims with what it proves: a claimed behaviour backed only by tests is "tests only". For an agent-written PR, note the commits made after the PR opened and the files they touched.

For a stack or a queue, start with one table: order, PR, title, author, size, risk, state (CI, approvals, verdict) and minutes. Risk is high when a design change touches authority, data, money or a production switch. Order a stack from the bottom. Order a queue so the PR that unblocks the most other PRs comes first, then the smallest. For a stack of more than about five PRs, offer `/eli25` for an overview page before the walk.

**Complete when** you have read every changed file and know what the body claims and what proves it.

## 3. Walk one PR at a time

Send each PR's review as one message in three parts: the intro, the tour and the wrap-up.

**Intro.**

1. The PR link, `https://github.com/<owner>/<repo>/pull/<n>`, first. In T3 it opens the PR panel beside the thread.
2. What the PR is and why, in a short paragraph of plain English, with one real example that uses real names and values.
3. One extra line only when something changes how you review: red CI, a claim backed by tests only, a one-way door or no `**Door:**` line, or review churn on an agent-written PR.

When the change can't be followed from the intro and the diff, such as a new subsystem, a flow across several parts or a PR over about 2,000 changed lines, follow the message with an `/eli25` page.

**Tour.** The whole route, in the order to read it: design changes first, most important first, then the rest of the route. A **design change** changes how the parts of the system fit together or what the system promises. Look for these, roughly in this order of importance:

- **Authority:** who may do what, as which identity, and where that is checked.
- **Data:** new or changed tables, columns, keys, indexes and migrations, and what is kept for how long.
- **Ownership:** which component now owns a piece of state, a process or a decision, and what moved.
- **Contracts:** APIs, events, protocols, message shapes, config keys and flags that other parts or other teams rely on.
- **Flow and timing:** new processes, queues, schedulers or loops, and their ordering, idempotency, retries and concurrency.
- **Failure:** what happens when a dependency is down or a step half-completes, and how it recovers.
- **Dependencies:** new external services or packages, and which way modules now depend on each other.
- **Rollout:** production switches, defaults, and changes that cannot be undone.

Each stop is one numbered item: the file and lines as a link, then what to look at there and why, in one or two sentences. For a design change, state the decision as one claim and say what it constrains, couples or makes hard to undo. Every file with a finding is a stop that names the finding and its priority. Point at the lines instead of quoting them. Count the files that carry no design, such as lockfiles and snapshots, in one closing line. When a PR has no design change, say so in one line and start the route at the first file with a finding.

````md
1. [fire.ts:351-372](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/fire.ts:351): **a reminder fires as the person who set it.** The tick claims a Slack event as the requester and rechecks membership, `slack:reply` and the channel audience on every attempt, so a reminder carries its requester's authority days after it was set.
2. [store.ts:88](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/store.ts:88): the claim is one `UPDATE` guarded by `claimed_at IS NULL`. **P1:** the row is read before the update, so two ticks can claim the same reminder.
````

**Wrap-up.**

1. **Findings.** The P0 and P1 problems and the design findings, such as a wrong owner, a missing seam, more parts than the job needs, or a promise the code does not keep. Give each its priority and a link.
2. **Questions for the author.** What the code alone cannot settle.
3. **Suggested verdict.** One line with the reason. Choose one of:
   - approve
   - approve with "please fix before <flag> is enabled", for features shipped behind a switch
   - request changes, only for a P0 or P1, or a change to production authority
4. One line that counts the style and smell notes, such as "4 style and smell notes; say `what else` to see them".

Keep the intro and the wrap-up under about 300 words together.

Write every code reference, in the tour and the wrap-up, as a Markdown link to the file in the review checkout, with the line after a colon: `[fire.ts:118](/Users/me/.agent/pr-review/app/540/src/runtime/reminders/fire.ts:118)`. T3 Code, Codex and Claude Code open these links in their own editor. A bare path is not clickable in every host and a GitHub link leaves the host, so code links always point at the local checkout. For a line range, link the first line and put the range in the label.

Show progress with each PR ("3 of 6"), then wait for the user's word:

| Word | What you do |
| --- | --- |
| `next` or `approve` | Record the decision, run `git update-ref refs/pr-review/<n>-seen <head>`, and start the next PR |
| `approve and post` | Post as in step 5, then do the same as `next` |
| `what else` | List the style and smell notes that were only counted |
| `how` | Explain one part in full with `/how`, or the whole change with `/explain-diff` |
| any comment | Add it to the ledger for this PR |
| `try` | Run the PR so the user can test it by hand, as below |
| `stop` | Finish with the report |

**Try it yourself.** When the user says `try`, run the app at this PR's head from its review checkout. The PR's code runs on the user's machine with their env files, so for a PR from a fork (`isCrossRepository` in `gh pr view`), say so and wait for a yes first.

1. Find the launch recipe, in this order: the repo's `verify-<app>` skill (`.agents/skills/verify-*/`) and its launch and doctor steps, then `EVIDENCE.md`, then the README and package scripts.
2. Prepare the review checkout: install dependencies with the repo's own package manager and lockfile, and copy the ignored env files the app needs (such as `.env` and `.env.local`) from the user's own checkout. Never print their values.
3. Start the app in the background on a free port, so it does not clash with anything the user is already running, and wait for its ready signal. Over ssh (`SSH_CONNECTION` set), put a web app on the tailnet with `tailscale serve` and give that URL. A mobile or desktop app builds and opens on the simulator or device the recipe names.
4. Hand over the URL, or how to open the app, and two to four things worth trying in this PR, taken from its tour and its claims, each with the expected result.
5. Keep it running while the user tests. When they say `next`, `approve`, `stop`, or `try` on another PR, stop only the processes this review started. Add anything they report to the PR's ledger.

**Complete for a PR when** the user has given their word and the `seen` ref points at the head they reviewed.

## 4. Return visits

When a PR's head has moved since `refs/pr-review/<n>-seen`, move its review checkout to the new head as in step 1, then show only what changed since the user last looked:

- If the branch was rebased, use `git range-diff <old base>..<seen> <base>..<head>`.
- Otherwise, use `git diff <seen>..<head>`.

Walk only that change, as in step 3, and say which earlier findings it fixes.

**Complete when** every change since the `seen` ref has a tag, and every earlier finding is marked fixed or still open.

## 5. Comments

Keep one ledger per PR. Collect from:

- The user's comments in chat.
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
