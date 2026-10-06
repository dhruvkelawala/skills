---
name: pr-watch
description: Use when the user invokes /pr-watch, asks to wait for a PR's checks or reviews, or wants review findings on a PR fixed until it is clean. Polls the PR with a gate script, repairs failed checks, review threads and written reviews, and stops when CI, threads and each configured reviewer are clean at the exact current HEAD.
---

# PR watch

Invoke as `/pr-watch [PR number | URL] [--reviewer <login>]... [--request-comment "<text>"] [--ignore-check <name>]... [--max-repairs N]`. With no PR argument, use the current branch's PR from `gh pr view`. The default repair budget is 10.

The loop observes the PR with the gate script, repairs what it reports, republishes, and observes again. The gate only reads GitHub, so every push and comment comes from you.

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

3. Reviewers only: the logins that reviewed recent merged PRs, from `gh pr list --state merged --limit 5` and `gh pr view <n> --json reviews,comments`.
4. Nothing. The gate then needs passing checks, no open threads, and no unanswered written review.

A reviewer is any account that reviews PRs in this repository: a bot such as Codex, CodeRabbit, Copilot or Claude, or a human the user names. The request comment is the exact text that asks a bot to review, such as `@codex review`. Post it at most once per HEAD, and only when the gate says the reviewer has not covered the current HEAD.

## What the gate counts

- **Checks.** When the base branch has required checks, only those block or hold the gate. Other checks appear in `notes` and never block. With no required checks, every check counts, so pass `--ignore-check <name>` for each optional check that should not hold the PR, such as a slow visual recap.
- **Merge state.** GitHub's UNSTABLE merge state does not block on its own. Conflicts, a draft or closed PR, and a HEAD mismatch still block.
- **Threads.** `threads` lists unresolved review threads with path, line, author and body.
- **Written reviews.** A COMMENTED review with a body, from a human account other than the PR author, appears in `threads` with `kind: "review"` and blocks. It counts as answered once the PR author posts a later PR comment or a later review with a non-empty body, or the same reviewer posts a newer review. The empty review that GitHub creates for a reply inside a thread does not answer it.

## Watch loop

1. Pin the HEAD. `git rev-parse HEAD` must equal the PR's `headRefOid`. If they differ, push or stop, so that you only watch a HEAD you verified.
2. Run the gate from this skill's directory:

   ```bash
   node "$SKILL_DIR/scripts/pr-gate.mjs" --repo "$OWNER/$REPO" --pr "$PR_NUMBER" \
     --expected-head "$HEAD_SHA" [--reviewer <login>]... [--request-comment "<text>"] \
     [--ignore-check "<name>"]... --watch --json
   ```

   Exit `0` is ready, `1` is pending or timed out, and `2` is blocked. Each JSON line is `{ state, reasons, threads, notes }`.
3. On pending with "has not reviewed the current HEAD" for a reviewer that takes a request comment, post the request once with `gh pr comment`, note the HEAD it was for, and watch again.
4. On a pending timeout, report the last reasons and stop. Waiting longer is the user's call.
5. On blocked, handle each reason:
   - **Failed check.** Read the log with `gh run view --log-failed` and fix the cause locally.
   - **Unresolved thread.** Read the whole thread with `gh api graphql` or `gh pr view --comments`, check the finding against the code, and fix it or reply with why it is wrong. Resolve the thread after its fix is pushed or its reply is posted.
   - **Written review** (`kind: "review"`). Read it, fix each point or decide against it, then post one PR comment with `gh pr comment` that answers it point by point.
   - **Changes requested by a human.** Address the review, then re-request it with `gh pr edit --add-reviewer`. Leave the human's review in place.
   - **Merge conflict or wrong base.** Rebase onto the live base, rerun the project's tests, and push with `--force-with-lease`.
   - **Draft, closed, or mismatched HEAD.** Stop and report, because these are not repairs.
6. A repair that changes code counts one against the budget. Hand the repaired tree to `/apr --no-watch`, which runs the focused tests, autoreview, commit and push once, with no nested watch. Return to step 1 with the new HEAD.
7. When the budget is spent, stop and report what remains open.

**Complete when:** the gate exits `0` for the exact current HEAD, or the budget or timeout is spent and the report lists every reason still open.

## Report

- PR URL and final HEAD SHA
- Gate result, the reviewers it required, the checks ignored, and any checks left in `notes`
- Repairs made: the count, and one line per finding with its source thread or check link, the HEAD it was reviewed at, and the repair commit, so that `/promote` can use them
- Findings rejected, with the reply posted
- Reasons still open
