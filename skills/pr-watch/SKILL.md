---
name: pr-watch
description: Use when the user invokes /pr-watch, asks to watch a PR's checks or reviews, wants review findings on a PR fixed until it is clean, or says "post" in a thread that watches a PR. Checks the PR with a gate script each time T3 wakes the thread, repairs failed checks and bot findings, drafts replies to people and holds them until "post", and hands the PR back once CI, threads and each configured reviewer are clean at the exact current HEAD.
---

# PR watch

Invoke as `/pr-watch [PR number | URL] [--reviewer <login>]... [--request-comment "<text>"] [--ignore-check <name>]... [--max-repairs N] [--run-record <path>]`. With no PR argument, use the current branch's PR from `gh pr view` (REST: `gh api "repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all"`). The default repair budget is 10.

The loop checks the PR with the gate script, repairs what it reports, republishes, and then asks T3 to wake the thread when the PR changes. The gate only reads GitHub, so every push and comment comes from you.

`gh pr` and `gh api graphql` spend the GraphQL quota that every agent on the account shares. When one of your calls fails with `API rate limit exceeded` or `RATE_LIMITED`, run the REST call named beside it, which draws on a separate quota. `gh api` fills `{owner}`, `{repo}` and `{branch}` from the current checkout.

## Configure

Resolve reviewers, the request comment and the checks to ignore from the first source that has them:

1. Flags on the invocation.
2. A `pr-watch` section in `AGENTS.md` or `CLAUDE.md`, for example:

   ```md
   ## pr-watch
   - reviewers: <bot login>, <human login>
   - request comment: @codex review
   - ignore checks: visual-recap / Gate, visual-recap / Generate visual recap
   ```

3. Reviewers only: the logins that reviewed recent merged PRs, from `gh pr list --state merged --limit 5` and `gh pr view <n> --json reviews,comments` (REST: `gh api "repos/{owner}/{repo}/pulls?state=closed&per_page=20"` keeping PRs with a `merged_at`, then `gh api repos/{owner}/{repo}/pulls/<n>/reviews` and `gh api repos/{owner}/{repo}/issues/<n>/comments`).
4. Nothing. The gate then needs passing checks where the repository has CI, no open threads, and no unanswered written review.

A reviewer is any account that reviews PRs in this repository: a bot such as Codex, CodeRabbit, Copilot or Claude, or a human the user names. The request comment is the exact text that asks a bot to review, such as `@codex review`. Post it at most once per HEAD, and only when the gate says the reviewer has not covered the current HEAD.

## Who hears from you

Bots hear from you without asking: replies to threads where `bot` is true and resolving them, the request comment, commits, pushes, the PR body and opening the PR. Nothing reaches a person in the user's name without the user's word. Draft these and hold them until the user says "post":

- a reply in a thread where `bot` is false, and resolving that thread
- a PR comment that answers a written review
- re-requesting a person's review

Keep the held items for a PR in `HELD=~/.agent/pr-watch/<owner>/<repo>/<pr>.held.json`, and hold each one with the script beside the gate. The ids come from the gate's `threads`:

```bash
node "$SKILL_DIR/scripts/held.mjs" hold --file "$HELD" --thread <id> --reply-to <replyTo> \
  --seen <lastCommentId> --to <person> --body-file <draft>
node "$SKILL_DIR/scripts/held.mjs" hold --file "$HELD" --review <id> --to <person> --body-file <draft>
node "$SKILL_DIR/scripts/held.mjs" hold --file "$HELD" --rerequest <login>
```

`--to` names the person you answer, who in a thread a bot opened is the person who spoke in it. Holding again for the same thread, review or person replaces the earlier draft. Show the user each draft when you hold it. With `--held-file "$HELD"`, the gate stops counting a thread or written review as a repair once its reply is held, and waits at pending with `<n> item(s) to people held until "post"`. A newer comment in a held thread brings the thread back, so read it and hold a new draft.

## When the user says "post"

Send everything held for this PR:

```bash
node "$SKILL_DIR/scripts/held.mjs" post --file "$HELD" --repo "$OWNER/$REPO" --pr "$PR_NUMBER" --record "$RECORD"
```

It sends the items in the order they were held: each reply and then the resolve of its thread, each comment, and each re-request. It removes an item from the held file once GitHub accepts it, and appends one line per send, with its link, to the run record. On a failure it stops with exit `2`, names the item, and keeps it and the rest held. A second run never sends anything twice.

- When someone has commented in a thread since its reply was drafted, `post` sends nothing to that thread and stops, and the gate lists the thread again.
- Reading a thread and resolving it need the GraphQL quota, so after `API rate limit exceeded` run `post` again once the quota resets.

Then go back to step 1 of the watch loop.

`$RECORD` is the `--run-record` the caller passed, such as `/issue-to-pr`'s record, and otherwise `~/.agent/pr-watch/<owner>/<repo>/<pr>.md`.

## What the gate counts

- **Checks.** When the base branch has required checks, only those block or hold the gate. Other checks appear in `notes` and never block. With no required checks, every check counts, so pass `--ignore-check <name>` for each optional check that should not hold the PR, such as a slow visual recap. A HEAD with no checks yet waits for them while the repository shows any sign of CI: an active workflow, a check the base branch requires, or results on the base branch's head or the last merged PR's head. With none of those, the repository has no CI, and the gate notes that there are no checks to wait on. Check suites are no sign, because apps register empty ones on every commit.
- **Merge state.** GitHub's UNSTABLE merge state does not block on its own. Conflicts, a draft or closed PR, and a HEAD mismatch still block.
- **Threads.** `threads` lists unresolved review threads with path, line, author, body and `bot`. `bot` is true when a bot opened the thread and no person has spoken in it since. Replies from the PR author keep it a bot's thread. An outdated thread drops out, unless it is a person's and the PR author has not answered it yet.
- **GraphQL quota.** When the gate's GraphQL query fails with a rate-limit error, it reads the PR, its checks, reviews, comments and reactions through REST, and holds at pending with `review threads unknown: GraphQL quota`, because REST cannot tell whether a thread is resolved. Each run tries GraphQL first, so the reason clears once the quota resets (`gh api rate_limit --jq .resources.graphql.reset`).
- **Written reviews.** A COMMENTED review with a body, from a human account other than the PR author, appears in `threads` with `kind: "review"` and blocks. It counts as answered once the PR author posts a later PR comment or a later review with a non-empty body, or the same reviewer posts a newer review. The empty review that GitHub creates for a reply inside a thread does not answer it.

## Watch loop

1. Pin the HEAD. `git rev-parse HEAD` must equal the PR's `headRefOid`. If they differ, push or stop, so that you only watch a HEAD you verified.
2. Run the gate once, from this skill's directory:

   ```bash
   node "$SKILL_DIR/scripts/pr-gate.mjs" --repo "$OWNER/$REPO" --pr "$PR_NUMBER" \
     --expected-head "$HEAD_SHA" [--reviewer <login>]... [--request-comment "<text>"] \
     [--ignore-check "<name>"]... --held-file "$HELD" --json
   ```

   Exit `0` is ready, `1` is pending, and `2` is blocked. The JSON is `{ state, reasons, threads, notes }`.
3. On pending with "has not reviewed the current HEAD" for a reviewer that takes a request comment, post the request once with `gh pr comment` (REST: `gh api -X POST repos/{owner}/{repo}/issues/<n>/comments -f body="<text>"`) and note the HEAD it was for.
4. On blocked, handle each reason:
   - **Failed check.** Read the log with `gh run view --log-failed` and fix the cause locally.
   - **Unresolved thread with `bot: true`.** Read the whole thread with `gh api graphql` or `gh pr view --comments` (REST: `gh api repos/{owner}/{repo}/pulls/<n>/comments`, where a reply's `in_reply_to_id` names the thread's first comment), check the finding against the code, and fix it or reply with why it is wrong. Resolve the thread after its fix is pushed or its reply is posted. Resolving has no REST call, so while the quota is spent, reply now and resolve after it resets.
   - **Unresolved thread with `bot: false`.** Read the whole thread the same way and check it against the code. Fix a clear request, and hold its reply in step 5, once the fix commit exists. Answer a question in a held reply. For a request you would decline, hold a reply that gives your reason, and change no code. `post` resolves the thread after the reply, so when you need the person's answer before you can act, ask the user instead of holding a question.
   - **Written review** (`kind: "review"`). Read it and fix each clear point. Hold one PR comment that answers it point by point, in step 5 when a point needed a fix.
   - **Changes requested by a person.** Fix the points in their threads as above. Answer the points in the review's own text in one held comment, where `--review` takes the review's `node_id` from `gh api repos/{owner}/{repo}/pulls/<n>/reviews`. Then hold a re-request, and leave their review in place. The gate shows CHANGES_REQUESTED until they review again. It is not a repair while the re-request is held, and once they appear in `gh pr view --json reviewRequests` (REST: `.requested_reviewers` from `gh api repos/{owner}/{repo}/pulls/<n>`), the PR waits on them.
   - **Merge conflict or wrong base.** Rebase onto the live base, rerun the project's tests, and push with `--force-with-lease`.
   - **Draft, closed, or mismatched HEAD.** Stop and report, because these are not repairs.
5. A repair that changes code counts one against the budget. Hand the repaired tree to `/apr --no-watch`, which runs the focused tests, autoreview, commit and push once, with no nested watch. Then hold each reply and comment to a person that names the fix commit, and return to step 1 with the new HEAD.
6. Once nothing is left to repair, decide who the PR waits on:
   - **Someone else**, such as a running check, a reviewer that has not covered the HEAD, or a person who has your posted reply or re-request. Call `watch_pull_request` for the PR and end the turn. T3 wakes the thread when a check fails, the required checks pass, someone else comments or reviews, or the branch starts to conflict, and you start again at step 1. It wakes only for comments made after the call, so handle the existing ones first. A wake is news, so run the gate before acting on it.
   - **The user**, when the gate exits `0`, anything is held for "post", the budget is spent, or a reason needs the user's decision. Call `unwatch_pull_request`, which returns the thread to the user's inbox, and report.

   A subagent cannot watch, because its parent thread owns the PR. It runs one pass and returns the PR URL, the HEAD, the gate result and the held file to the parent.

**Complete when:** the gate exits `0` for the exact current HEAD and the PR is unwatched, or the PR waits on someone else and T3 watches it, or it waits on the user, is unwatched, and the report lists what is held and every reason still open.

## Report

- Who the PR waits on, and whether T3 watches it
- Held for "post": each item with its draft, or what the last "post" sent
- PR URL and final HEAD SHA
- Gate result, the reviewers it required, the checks ignored, and any checks left in `notes`
- Repairs made: the count, and one line per finding with its source thread or check link, the HEAD it was reviewed at, and the repair commit, so that `/promote` can use them
- Findings rejected, with the reply posted or held
- Reasons still open
