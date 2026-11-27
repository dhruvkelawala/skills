---
name: pr-review
description: Review a PR or a stack, or the current project's review queue in one sitting, one PR at a time. It owns the review queue, and /pr-review queue starts at its top. /code-review and an independent second opinion find the problems first while T3 writes the tour in the PR's Guide tab; the agent then explains the PR in an intro and a wrap-up with a suggested verdict, and posts one review only on the user's word. Use when the user invokes /pr-review, asks to review, walk through or test a PR, a stack or a diff before approving, asks what to review next or for the review queue, or asks to review their own open PRs or PRs by an author.
compatibility: Requires git and gh.
---

# PR review

The reviewers find the problems, and you explain them. On every PR, `/code-review` and an independent second opinion read the change before you write about it. Prefer the other model family for that opinion, with [model-policy](../model-policy/SKILL.md) keeping reviews on the available family during an outage or rate limit. You read everything too, implementation included, and sort what they found. T3 writes the tour as the PR's review guide, which the user reads in the PR panel's Guide tab with each stop's lines in place, and your message in chat is the intro and the wrap-up. The user decides, and nothing reaches GitHub until they say so.

Invoke as `/pr-review [<PR> | <PR in a stack> | <base>..<head> | queue [--mine | --author <login>]]`. "Review PRs by <author>" starts `queue --author <login>` directly.

For GitHub calls, use GraphQL or REST within the shared [API limits](../pr-watch/references/github-api.md). Keep using the queue script for its ordering and selection rules.

| Argument | What it reviews |
| --- | --- |
| none | The current branch's PR, or the branch changes when there is no PR |
| a PR | That PR |
| a PR in a stack | The whole stack, bottom up |
| `<base>..<head>` | The changes in that range |
| `queue` | A sitting over the current project's queue, from its top |
| `queue --mine` | A sitting over the user's own open PRs in the current project |
| `queue --author <login>` | A sitting over that author's ready PRs, including PRs without a review request |

## The queue

The queue is every open PR waiting on the user's review. `node <this skill's folder>/scripts/queue.mjs --repo <owner>/<repo>` prints one repository's queue as a JSON list in the order to walk it, and without `--repo` it covers every repository. Another skill that needs the queue runs the same command.

- **In the queue:** PRs that ask for the user's review, and PRs the user reviewed before that have moved since. Drafts, the user's own PRs and archived repositories stay out.
- **With `--mine`:** the user's own open PRs instead, every one of them, in the same order and with the same entries. Drafts and archived repositories still stay out.
- **With `--author <login>`:** that author's open, ready PRs instead, regardless of review requests or earlier reviews. It can name the user too. Drafts and archived repositories stay out; use either `--mine` or `--author`.
- **With `--ready-since <ISO timestamp>`:** only PRs with a GitHub `ready_for_review` event at or after that timestamp that are still open and ready. This finds newly ready PRs without a review request. It accepts the same repository and author selectors, excludes the user's PRs by default, and adds `readyAt` to each entry. Use a timestamp with a timezone, such as `2026-11-18T09:00:00Z`. With `--repo`, it reads the current open PRs directly; without it, GitHub search first narrows candidates by update date.
- **The order:** return visits first, then stack bottoms (PRs that don't sit on another open PR), then the PR that unblocks the most (the open PRs stacked on it), then the smallest.

Each entry has `repo`, `number`, `url`, `title`, `author`, `base`, `head`, `size`, `files`, `returnVisit`, `stackBottom` and `unblocks`.

A **sitting** walks the selected queue in one thread, with no time cap. At the start of every review session, record its UTC start timestamp and the repository and author selectors. Keep the PRs and heads reviewed during the session for the closing refresh in Report.

1. Read the queue with `--repo` set to the current checkout's repository, from `gh api repos/{owner}/{repo} --jq .full_name`, and with the requested `--mine` or `--author` selector. When it is empty, run Report's closing refresh before saying the session is done.
2. Walk it from the top, one PR at a time, until the user says `stop` or the queue runs out.
3. The user doesn't see the script's output, so the first PR's review opens with the queue: one table in the queue's order, with a row per PR giving the PR (repository and number), title, author, size, and whether it is a return visit or sits on another PR.

## 1. Pin each PR

For each PR, read `gh pr view <n> --json number,url,title,author,body,baseRefName,baseRefOid,headRefOid,additions,deletions,changedFiles,commits`. Then fetch the base and `refs/pull/<n>/head`, and pin both commits:

```bash
git fetch origin <baseRefName> refs/pull/<n>/head
git update-ref refs/pr-review/<n>-base <baseRefOid>
git update-ref refs/pr-review/<n>-head <headRefOid>
```

Review the range `refs/pr-review/<n>-base...refs/pr-review/<n>-head`. For a plain range, resolve both ends to commit IDs the same way.

A PR in another repository than the current checkout's needs a clone of it. Make one at `$HOME/.agent/pr-review/<repo>/clone` the first time, with `gh repo clone <owner>/<repo> <that path> -- --filter=blob:none`, and run this step's git commands there.

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

Prep comes before the PR's review (step 3), on every PR. A prep record (item 7) is complete only when it contains completed Standards, Spec and second-opinion reports for the current head. If complete, start no reviewer, check its guide as item 6 does, and complete item 3's presentation check if it is missing for this head, then go to step 3. Otherwise run prep below, retaining completed reports for this head and starting the missing reviews.

1. **Start the guide.** It takes a few minutes, so start it first. Read it with `read_pull_request_guide`, and call `write_pull_request_guides` unless it is already written for the PR's head. A guide written for an older head is `stale` after any push, a rebase included, and is written again. For a stack or a sitting, name every PR in scope that needs a guide in one call (up to 20), so each one is written before the walk reaches it. T3 writes it on the model its own settings name, and the models file has no job for it. When the guide tools are unavailable or require a T3 thread credential, mark the PR as having no guide and use the chat tour.
2. Start both reviewers at once, from the PR's review checkout. Each runs on its job in the models file, `models.json` in the real directory that holds this skill's folder (`cd -P <this skill's folder>/.. && pwd`):
   Compare the PR author's login with `gh api user --jq .login`. On someone else's PR, include this scope in every reviewer brief, including `/code-review`'s Standards and Spec children: "Standards = only this repo's checked-in instructions and docs plus the spec; ignore personal/global files such as `~/.claude/CLAUDE.md`, `~/.agents`, and memory, even if already in context." Set `$REVIEW_SCOPE` to that text for the second opinion, or to an empty string on the user's own PR.

   - **`/code-review`.** Load and follow `/code-review refs/pr-review/<n>-base`, with the PR body and the issue it closes as the spec. Run its Standards and Spec reviewers as `delegate_task` children on the `reviewers` job when T3 delegation is available. Otherwise use the local route below.
   - **The second opinion,** on the `second-opinion` job, preferably from the other model family than this thread's. Resolve `$AUTOREVIEW`, the engine and `$ENGINE_FLAGS` as [apr](../apr/SKILL.md) step 1 does, then run `"$AUTOREVIEW" --mode branch --base <base SHA> --engine <engine> $ENGINE_FLAGS --prompt "$REVIEW_SCOPE"` from the review checkout.

   **Local reviewers.** When `delegate_task` is unavailable, the session is outside a T3 thread, or delegation fails with a thread/credential error such as `thread_credential_required`, start fresh local `Agent` subagents for Standards and Spec in parallel in the foreground, using the `reviewers` job's model. Resolve the local `Agent.model` alias from that entry. This is the default route in that case; start it without asking the user. Give each the same `/code-review` brief, pinned base and head, review checkout, spec, and repo-scope rule. Include the full smell baseline in the Standards brief. Keep completed reports if only one axis needs replacement, and stop any still-running attempt before replacing it. The second opinion remains required. If local subagents cannot run, record the missing reports and leave prep incomplete.

   When a job's model can't run, apply model-policy and its `ifUnavailable` on the available family, retaining fresh reviewer contexts. Record the fallback and coverage limit. If neither family can complete a required review, report that gap without claiming prep complete.
3. While they run, read the whole diff, the PR body, the issue it closes, the CI state, the approvals and the `**Door:**` line. Lockfiles, generated files, snapshots and pure renames (`R100` in `git diff -M --name-status`) carry no design. Compare what the body claims with what it proves: a claimed behaviour backed only by tests is "tests only". For an agent-written PR, note the commits made after the PR opened and the files they touched.

   **Presentation.** When a PR changes what people see, including Slack messages, cards, buttons or app UI, open and inspect the PR's evidence screenshots for the changed states. Judge the presentation yourself: hierarchy, wording, spacing, density and action clarity. Standards, Spec and the second opinion cover code and requirements; their reports do not establish that the result looks good. Record the images opened, which changed states they cover, any known capture revision and your visual findings in the prep record. Identify missing, unreadable or stale evidence and request current screenshots or suggest `try`; keep approval conditional until the changed presentation has been inspected.

4. Once Standards, Spec and the second opinion have all reported, check each finding against the code at the head, then sort it: a correctness bug, a design finding, a question for the author, or a style or smell note. Keep the priority the reviewer gave. For a confirmed P2 correctness bug, check the production path and any feature flag's current state to establish whether it goes live at merge. Record the evidence in the prep record. When the code shows a finding is wrong, keep it for the wrap-up with your reason.
5. When the PR needs the verifier (step 3), start it now.
6. Check the guide with `read_pull_request_guide`, unless item 1 already established there is no guide. While its run is `Running`, wait a minute and read it again. It is ready when it is written for the PR's head. The PR has no guide when guides are off (`write_pull_request_guides` fails), its run is `Failed`, or it is still running after about ten minutes. Then step 3 writes the tour in chat.
7. Write the prep record, `$HOME/.agent/pr-review/<repo>/<n>.md`: the head, the patch ID from `git diff refs/pr-review/<n>-base...refs/pr-review/<n>-head | git patch-id --stable`, which reviewers reported with their actual models and any fallback reason, and each finding with its reviewer, priority, `file:line` and how you sorted it. For local reviewers, record `local Agent`, each axis's model, and why T3 delegation was unavailable. A return visit reads it.

For a stack, start with one table, from the bottom: order, PR, title, author, size, risk, state (CI, approvals, verdict) and minutes. Risk is high when a design change touches authority, data, money or a production switch. For a stack of more than about five PRs, offer `/eli25` for an overview page before the walk.

**Complete when** Standards, Spec and the second opinion have all reported on the PR's head, you have read every changed file, every finding is sorted and in the prep record, and the guide is written for the head or the PR has no guide. For user-facing changes, record the presentation assessment or its evidence gap too. Until then, report the pending prep without a suggested verdict. A single-pass review by this thread never substitutes for either axis.

## 3. Walk one PR at a time

Send each PR's review as one message: the intro, then the wrap-up. In a sitting, the first one opens with the queue table. The tour is the guide, so chat lists no stops and no file links. When the PR has no guide (step 2), the chat tour goes between the intro and the wrap-up.

**The next PR's prep runs while the user reads.** In a sitting or a stack, when the walk reaches a PR, start the next PR's prep in the background, unless its prep record is complete for its head as step 2 defines:

- Give it to one `delegate_task` child, async, on the `teammate-prep` job in the models file for someone else's PR, or on the thread's model for the user's own. When the job's model can't run, do what its `ifUnavailable` says.
- Its task names the PR's URL and head. The child loads this skill, runs step 1 and prep for that PR only (step 2, or step 4's for a return visit), the reviewers included, and adds a draft of the review message to the prep record. It sends the user nothing, posts nothing, and leaves the `seen` ref alone.
- On `next`, wait for the child if it is still running, then start the next PR from its completed prep record, and from its draft when it has one. When it failed or its record is incomplete, finish prep yourself.
- A background prep still running at `stop` finishes on its own, and its record lets the next sitting start that PR without rerunning its reviewers.

**Intro.**

1. The PR link, `https://github.com/<owner>/<repo>/pull/<n>`, first. In T3 it opens the PR panel beside the thread. Then say that the tour is in that panel's Guide tab or, when the PR has no guide, why the tour is in chat.
2. What the PR is and why, in a short paragraph of plain English, with one real example that uses real names and values.
3. One extra line only when something changes how you review: red CI, a claim backed by tests only, a one-way door or no `**Door:**` line, or review churn on an agent-written PR.
   When local reviewers ran, include one line naming their route, actual model and the T3 failure reason.
4. For user-facing changes, give your presentation judgment from the opened screenshots in one or two sentences, naming the evidence and the concrete strengths or problems. Put it here in the intro, before any suggested verdict. When presentation evidence is missing, unreadable or stale, say what remains unassessed and suggest current screenshots or `try`.

When the change can't be followed from the intro and the diff, such as a new subsystem, a flow across several parts or a PR over about 2,000 changed lines, follow the message with an `/eli25` page.

**The guide.** The user reads the tour there, marks files viewed, and sends you an excerpt with "Ask agent". Leave viewed marks to the user.

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

1. **Findings.** The reviewers' P0 and P1 findings, confirmed P2 correctness bugs that go live at merge, and their design findings, such as a wrong owner, a missing seam, more parts than the job needs, or a promise the code does not keep. Give each its priority, its reviewer, and its file and line. A finding you think is wrong stays here with your reason.
2. **Questions.** Ask the author about facts neither the reviewers nor the code could settle. For an ADR, contract or product decision only Dhruv can make, ask Dhruv and give the suggested verdict for each possible answer in this same message, with its reason. Write one conditional verdict per line beside the question, once prep's reviewer completion gate passes. Keep the decision open until Dhruv answers.
3. **Verifier.** Its result, when it ran.
4. **Suggested verdict.** Only after the prep completion gate in step 2 passes, one line with the reason, or refer to the conditional verdict lines beside an unresolved Dhruv-only question. Choose one of:
   - approve
   - approve with "please fix before <flag> is enabled", for features shipped behind a switch
   - request changes, for a P0 or P1, a change to production authority, or a confirmed P2 correctness bug that goes live at merge because no feature flag guards it or its flag is already enabled. State that go-live reason in the verdict line, for example "request changes: P2 loses the saved selection on refresh; this path has no feature flag and ships at merge."

   A P2 style note or missing test alone does not qualify. For a P2 behind a flag confirmed off, use "please fix before <flag> is enabled". When its state is unknown, name that uncertainty and ask the author rather than assume the bug is live.
5. One line that counts the style and smell notes, such as "4 style and smell notes; say `what else` to see them".

**Verdict options.** Before offering alternatives, separate "Fixable in this PR" from "Needs a separate issue" and name what belongs in each. Give each option on its own line, with its action, scope, verdict and reason. Keep conditional verdicts beside their decision question. Filing a separate issue does not clear a merge-blocking finding.

Keep the intro and the wrap-up under about 300 words together, not counting the queue table.

**Verifier.** Run the `verifier` job only for a PR that touches authority, data, money or a production switch where its proof doesn't cover that, or when the user says `verify`. Follow [ship's verification preparation](../ship/references/verification.md) for readiness, reuse and replacements, recording its disposition in the prep record. If deferred, report the reason in the wrap-up. When a new run is needed, give a fresh `delegate_task` child on that job's entry, `onTeammatePr` on someone else's PR, the bounded brief and three lanes in step 2 of [ship's verify](../ship/SKILL.md#verify). Its PASS, PASS+NOTES or FAIL, with the evidence for each lane, goes into the wrap-up and into the review you post, rather than a comment of its own. When it is still running at the intro, the wrap-up says so, and its result follows when it returns.

Write a code reference as plain text, the file and line in backticks such as `src/runtime/reminders/store.ts:88`, never as a link. A local path doesn't open on a phone, and a GitHub link leaves T3.

**One PR at a time.** In a session with several PRs, review them one by one: never put the reviews of several PRs into one message or a batch table unless the user asks for one. In OpenBot, end each PR with a verdict card (`openbot.ask_ui`) with the buttons Approve and post, Approve, Request changes and post, and Next. Approve and post, and Request changes and post, post that verdict's review straight away with no second confirmation card; Approve records the verdict and posts nothing; Next does what `next` does. Typed words below work the same way.

Show progress with each PR ("3 of 6"), then wait for the user's word:

| Word | What you do |
| --- | --- |
| `next` | Record progress, run `git update-ref refs/pr-review/<n>-seen <head>`, and start the next PR from its background prep. |
| `approve` or `request changes`, with or without "and post" | Record the verdict and post it as step 5 describes, with no second confirmation card. After posting, do the same as `next`. |
| `post` | Follow step 5 to confirm and post a COMMENT review, then do the same as `next`. |
| `draft it` or `don't post` | Keep the review unposted, even when the message also names a verdict. Show the draft and wait. |
| `what else` | List the style and smell notes that were only counted |
| `verify` | Run the verifier on this PR and add its result to the wrap-up |
| `how` | Explain one part in full with `/how`, or the whole change with `/explain-diff` |
| any comment | Add it to the ledger for this PR |
| `try` | Run the PR so the user can test it by hand, as below |
| `stop` | Finish with the report |

**Try it yourself.** When the user says `try`, run the app at this PR's head from its review checkout. The PR's code runs on the user's machine with their env files, so for a PR from a fork (`isCrossRepository` in `gh pr view`), say so and wait for a yes first.

1. Find the launch recipe, in this order: the repo's `verify-<app>` skill (`.agents/skills/verify-*/`) and its launch and doctor steps, then `EVIDENCE.md`, then the README and package scripts.
2. Prepare the review checkout: install dependencies with the repo's own package manager and lockfile, and copy the ignored env files the app needs (such as `.env` and `.env.local`) from the user's own checkout. Never print their values.
3. Start the app in the background on a free port, so it does not clash with anything the user is already running, and wait for its ready signal. Open a web app in T3's preview browser (`preview_open`), and a mobile app in T3's device panel (`device_open`) on the simulator or emulator the recipe names. A desktop app opens on this machine. When the change is motion the user should feel on a phone, also put the app on the tailnet with `tailscale serve` and give that link. Never hand over a `localhost` link.
4. Say where the app is open, and give two to four things worth trying in this PR, taken from its tour and its claims, each with the expected result.
5. Keep it running while the user tests. When they say `next`, `approve`, `stop`, or `try` on another PR, stop only the processes this review started. Add anything they report to the PR's ledger.

**Complete for a PR when** the user has given their word and the `seen` ref points at the head they reviewed.

## 4. Return visits

When a PR's head has moved since `refs/pr-review/<n>-seen`, move its review checkout to the new head as in step 1, and read its prep record. Then start and check its guide as prep's items 1 and 6 do. A pure rebase needs a new guide too. Carry forward a presentation assessment only when its screenshots still cover the changed UI; otherwise repeat prep's item 3 check, including after a pure rebase.

1. **Your earlier comments.** Open with one status line on what the user said last time, from the ledger and their comments on GitHub: how many are fixed, answered or still open, with a link to each open one.
2. **A pure rebase.** Compute the patch ID as prep does. When it matches a completed prep record's, the branch was only rebased: say so in one line, skip both reviewers, and keep the earlier findings as they stand. In chat, that line is the whole tour. Complete any missing reviews in a partial record as step 2 requires before giving a verdict.
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
- **Someone else's PR.** Draft one review in the user's voice: a short body that opens with pr-watch's [label](../pr-watch/SKILL.md#the-label), the verifier's result when it ran, and inline comments anchored on added lines.
  - Write like the user: short and direct, with "Nit:", "Non-blocking:" and "Please fix before X is enabled" where they fit.
  - In Dhruv's sessions, `approve` means record and post APPROVE, and `request changes` means record and post REQUEST_CHANGES. "And post" is optional; `post` alone sends COMMENT. `draft it` or `don't post` overrides posting intent. Other sessions follow their user's posting convention.
  - **A verdict approves the verdict only.** Before posting, check the review body and inline comments for any decision, policy, commitment or question in Dhruv's name that he has not already stated himself in this session or on the PR (for example "strip private and Slack Connect quotes until this is settled"). When there is any, show him that exact text and get his OK or his edit before posting, even after "and post" or a verdict button. Otherwise word it as the reviewer's question to the author, or leave it out.
  - Check the draft with `node <this skill's folder>/../pr-watch/scripts/held.mjs check --body-file <file>`. When the user has already given a posting verdict (`approve` or `request changes` in Dhruv's sessions, "and post", or a verdict card's posting button), post it now without a further confirmation card. Otherwise show the exact review, inline comments, PR and verdict in the host's usual confirmation card. In OpenBot use `openbot.ask_ui` with Send, Edit and Keep draft buttons. After Send, post that review once through `gh api repos/<owner>/<repo>/pulls/<n>/reviews`, with `commit_id` set to the reviewed head. Edit revises the draft and presents it again; Keep draft, cancellation or a declined confirmation leaves it unposted. A recorded verdict alone does not mean a review was posted. Report the posted review URL only after GitHub confirms it.

**Complete when** every ledger item is fixed, posted, or dropped by the user.

## Report

Before ending any session, including an initially empty queue, an exhausted queue or `stop`, re-run the queue with its original repository and author selectors. Then run it again with those selectors and `--ready-since <session-start>`. Combine and deduplicate by repository and PR number; leave out heads already reviewed in this session. Offer the remaining PR links, naming any that became ready during the session. Keep the refreshed queue in its normal order. A user who said `stop` gets the offer only; start no new prep or review. If a refresh fails, report that the closing queue could not be checked.

First remove the review checkouts of PRs that were approved, merged or closed: `git worktree remove "$HOME/.agent/pr-review/<repo>/<n>"`. Keep the checkout of a PR still waiting on changes, for the return visit.

- For each PR: the decision, the posted review URL or "not posted", and the findings still open.
- For a stack or a sitting: how many PRs are done, and what is left.
