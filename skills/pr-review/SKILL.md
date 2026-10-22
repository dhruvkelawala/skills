---
name: pr-review
description: Review a pull request, a stack, or the PRs waiting on the user, one PR at a time. /code-review and a second opinion from the other model family find the problems first while T3 writes the tour in the PR's Guide tab; the agent then explains the PR in an intro and a wrap-up with a suggested verdict, and posts one review only on the user's word. Use when the user invokes /pr-review, asks to review, walk through or test a PR, a stack or a diff before approving, or asks what to review next.
compatibility: Requires git and gh.
---

# PR review

The reviewers find the problems, and you explain them. On every PR, `/code-review` and a second opinion from the other model family read the change before you write about it. You read everything too, implementation included, and sort what they found. T3 writes the tour as the PR's review guide, which the user reads in the PR panel's Guide tab, and your message in chat is the intro and the wrap-up. The user decides, and nothing reaches GitHub until they say so.

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

Then give each PR a read-only checkout of its head, for the reviewers and `try` to run from:

```bash
dir="$HOME/.agent/pr-review/<repo>/<n>"            # <repo> is the repository's name
git worktree add --detach "$dir" refs/pr-review/<n>-head 2>/dev/null \
  || git -C "$dir" checkout --detach refs/pr-review/<n>-head
```

Read the head side from that checkout and the base side with `git show`. Make no edits or commits there, and leave the user's own checkout on its branch. When the PR's head is already checked out in the current checkout, use that instead.

If `refs/pr-review/<n>-seen` exists and differs from the head, the user has seen an earlier version. Use step 4 for that PR.

**Complete when** every PR in scope has a pinned range and a review checkout at its head, and its file list matches `gh pr view <n> --json files`.

## 2. Prep

Prep comes before anything you write about the PR, on every PR.

1. **Start the guide.** T3 writes the PR's review guide, the tour the user reads in the PR panel's Guide tab with each stop's lines in place. It takes a few minutes, so start it first. Read it with `read_pull_request_guide`, and call `write_pull_request_guides` unless it is already written for the PR's head. A guide written for an older head is `stale` after any push, a rebase included, and is written again. For a stack or a queue, name every PR in scope that needs a guide in one call, so each one is written before the walk reaches it. T3 writes it on the model its own settings name, and the models file has no job for it.
2. Start both reviewers at once, from the PR's review checkout. Each runs on its job in the models file, `models.json` in the real directory that holds this skill's folder (`cd -P <this skill's folder>/.. && pwd`):
   - **`/code-review`.** Load and follow `/code-review refs/pr-review/<n>-base`, with the PR body and the issue it closes as the spec. Run its Standards and Spec reviewers as `delegate_task` children on the `reviewers` job.
   - **The second opinion,** on the `second-opinion` job, from the other model family than this thread's. Resolve `$AUTOREVIEW`, the engine and `$ENGINE_FLAGS` as [apr](../apr/SKILL.md) step 1 does, then run `"$AUTOREVIEW" --mode branch --base <base SHA> --engine <engine> $ENGINE_FLAGS` from the review checkout.

   When a job's model can't run, do what its `ifUnavailable` says. For `wait`, tell the user which reviewer is missing and wait for their word.
3. While they run, read the whole diff, the PR body, the issue it closes, the CI state, the approvals and the `**Door:**` line. Lockfiles, generated files, snapshots and pure renames (`R100` in `git diff -M --name-status`) carry no design. Compare what the body claims with what it proves: a claimed behaviour backed only by tests is "tests only". For an agent-written PR, note the commits made after the PR opened and the files they touched.
4. Once both reviewers have reported, check each finding against the code at the head, then sort it: a P0 or P1, a design finding, a question for the author, or a style or smell note. Keep the priority the reviewer gave. When the code shows a finding is wrong, keep it for the wrap-up with your reason.
5. When the PR needs the verifier (step 3), start it now.
6. Check the guide with `read_pull_request_guide`. While its run is `Running`, wait a minute and read it again. It is ready when it is written for the PR's head. The PR has no guide when guides are off (`write_pull_request_guides` fails), its run is `Failed`, it is still running after about ten minutes, or this host has no T3 guide tools. Then step 3 writes the tour in chat.
7. Write the prep record, `$HOME/.agent/pr-review/<repo>/<n>.md`: the head, the patch ID from `git diff refs/pr-review/<n>-base...refs/pr-review/<n>-head | git patch-id --stable`, and each finding with its reviewer, priority, `file:line` and how you sorted it. A return visit reads it.

For a stack or a queue, start with one table: order, PR, title, author, size, risk, state (CI, approvals, verdict) and minutes. Risk is high when a design change touches authority, data, money or a production switch. Order a stack from the bottom. Order a queue so the PR that unblocks the most other PRs comes first, then the smallest. For a stack of more than about five PRs, offer `/eli25` for an overview page before the walk.

**Complete when** both reviewers have reported on the PR's head, you have read every changed file, every finding is sorted and in the prep record, and the guide is written for the head or the PR has no guide.

## 3. Walk one PR at a time

Send each PR's review as one message: the intro, then the wrap-up. The tour is the guide, so chat lists no stops and no file links. When the PR has no guide (step 2), the chat tour goes between the intro and the wrap-up.

**Intro.**

1. The PR link, `https://github.com/<owner>/<repo>/pull/<n>`, first. In T3 it opens the PR panel beside the thread. Then say that the tour is in that panel's Guide tab or, when the PR has no guide, why the tour is in chat.
2. What the PR is and why, in a short paragraph of plain English, with one real example that uses real names and values.
3. One extra line only when something changes how you review: red CI, a claim backed by tests only, a one-way door or no `**Door:**` line, or review churn on an agent-written PR.

When the change can't be followed from the intro and the diff, such as a new subsystem, a flow across several parts or a PR over about 2,000 changed lines, follow the message with an `/eli25` page.

**The guide.** The user reads the tour there, marks files viewed, and sends you an excerpt with "Ask agent". Viewed marks are the user's, so never set them.

**Chat tour, when there is no guide.** The whole route, in the order to read it: design changes first, most important first, then the rest of the route. A **design change** changes how the parts of the system fit together or what the system promises. Look for these, roughly in this order of importance:

- **Authority:** who may do what, as which identity, and where that is checked.
- **Data:** new or changed tables, columns, keys, indexes and migrations, and what is kept for how long.
- **Ownership:** which component now owns a piece of state, a process or a decision, and what moved.
- **Contracts:** APIs, events, protocols, message shapes, config keys and flags that other parts or other teams rely on.
- **Flow and timing:** new processes, queues, schedulers or loops, and their ordering, idempotency, retries and concurrency.
- **Failure:** what happens when a dependency is down or a step half-completes, and how it recovers.
- **Dependencies:** new external services or packages, and which way modules now depend on each other.
- **Rollout:** production switches, defaults, and changes that cannot be undone.

Each stop is one numbered item: the file and lines, the name the lines define (a function, a test, or a constant), then what to look at there and why, in one or two sentences. For a design change, state the decision as one claim and say what it constrains, couples or makes hard to undo. Every file a reviewer flagged is a stop that names the finding, its priority and its reviewer, at any priority. Point at the lines instead of quoting them. Count the files that carry no design, such as lockfiles and snapshots, in one closing line. When a PR has no design change, say so in one line and start the route at the first flagged file.

````md
1. `src/runtime/reminders/fire.ts:351-372`, `fireReminder`: **a reminder fires as the person who set it.** The tick claims a Slack event as the requester and rechecks membership, `slack:reply` and the channel audience on every attempt, so a reminder carries its requester's authority days after it was set.
2. `src/runtime/reminders/store.ts:88`, `claimReminder`: the claim is one `UPDATE` guarded by `claimed_at IS NULL`. **P1, second opinion:** the row is read before the update, so two ticks can claim the same reminder.
3. `test/runtime/reminders/fire.test.ts:40-61`, "a reminder fires as its requester": the only test of the tick. **P2, Spec:** it runs one tick at a time, so it passes with the double claim above.
````

**Wrap-up.**

1. **Findings.** The reviewers' P0 and P1 findings and their design findings, such as a wrong owner, a missing seam, more parts than the job needs, or a promise the code does not keep. Give each its priority, its reviewer, and its file and line. A finding you think is wrong stays here with your reason.
2. **Questions for the author.** What neither the reviewers nor the code could settle.
3. **Verifier.** Its result, when it ran.
4. **Suggested verdict.** One line with the reason. Choose one of:
   - approve
   - approve with "please fix before <flag> is enabled", for features shipped behind a switch
   - request changes, only for a P0 or P1, or a change to production authority
5. One line that counts the style and smell notes, such as "4 style and smell notes; say `what else` to see them".

Keep the intro and the wrap-up under about 300 words together.

**Verifier.** Run the `verifier` job only for a PR that touches authority, data, money or a production switch where its proof doesn't cover that, or when the user says `verify`. Give a fresh `delegate_task` child on that job's entry, `onTeammatePr` on someone else's PR, the PR number, the head SHA and the three lanes in step 2 of [ship's verify](../ship/SKILL.md#verify). Its PASS, PASS+NOTES or FAIL, with the evidence for each lane, goes into the wrap-up and into the review you post, rather than a comment of its own. When it is still running at the intro, the wrap-up says so, and its result follows when it returns.

Write a code reference as plain text, the file and line in backticks such as `src/runtime/reminders/store.ts:88`, never as a link. A local path doesn't open on a phone, and a GitHub link leaves T3.

Show progress with each PR ("3 of 6"), then wait for the user's word:

| Word | What you do |
| --- | --- |
| `next` or `approve` | Record the decision, run `git update-ref refs/pr-review/<n>-seen <head>`, and start the next PR. Nothing is posted. |
| "post", "approve and post" or "request changes and post" | Post the review as in step 5, then do the same as `next` |
| `what else` | List the style and smell notes that were only counted |
| `verify` | Run the verifier on this PR and add its result to the wrap-up |
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

When a PR's head has moved since `refs/pr-review/<n>-seen`, move its review checkout to the new head as in step 1, and read its prep record. Its guide is for the old head, so start it again and check it before you write, as prep does, after a pure rebase too.

1. **Your earlier comments.** Open with one status line on what the user said last time, from the ledger and their comments on GitHub: how many are fixed, answered or still open, with a link to each open one.
2. **A pure rebase.** Compute the patch ID as prep does. When it matches the record's, the branch was only rebased: say so in one line, skip both reviewers, and keep the earlier findings as they stand. In chat, that line is the whole tour.
3. **A real change** reruns both reviewers on the new head, over the whole PR, as in step 2. Show only the new findings, and mark each earlier one fixed or still open. Say what changed since the user last looked: `git range-diff <old base>..<seen> <base>..<head>` when the branch was also rebased, otherwise `git diff <seen>..<head>`. A chat tour covers only those changes. Then the wrap-up, as in step 3.
4. Update the prep record to the new head.

**Complete when** every earlier finding is marked fixed or still open, and every change since the `seen` ref is named in the review or the rebase line.

## 5. Your word

Keep one ledger per PR. Collect from:

- The user's comments in chat.
- What they send you with "Ask agent" on a guide excerpt, or "Add to agent" in the Code tab. T3's "Add to review" and "Finish review" stay unused, because the review posts as below.
- Existing GitHub threads, so nothing is said twice.

What happens next depends on whose PR it is:

- **The user's own PR** (the PR author equals `gh api user --jq .login`). Each item becomes a fix for the agent that owns the branch, or for you when they ask. Nothing is posted.
- **Someone else's PR.** Draft one review in the user's voice: a short body, the verifier's result when it ran, and inline comments anchored on added lines.
  - Write like the user: short and direct, with "Nit:", "Non-blocking:" and "Please fix before X is enabled" where they fit.
  - Show the draft, and post it only on the user's word for this PR: "post" sends it as COMMENT, "approve and post" as APPROVE, and "request changes and post" as REQUEST_CHANGES, through `gh api repos/<owner>/<repo>/pulls/<n>/reviews` with `commit_id` set to the reviewed head.

**Complete when** every ledger item is fixed, posted, or dropped by the user.

## Report

First remove the review checkouts of PRs that were approved, merged or closed: `git worktree remove "$HOME/.agent/pr-review/<repo>/<n>"`. Keep the checkout of a PR still waiting on changes, for the return visit.

- For each PR: the decision, the posted review URL or "not posted", and the findings still open.
- For a stack or a queue: how many PRs are done, and what is left.
