---
name: pr-watch
description: Poll an open pull request until CI is green, every review thread is resolved, and each configured review agent has covered the exact current HEAD, repairing findings in between. Use when the user invokes /pr-watch, asks to wait for PR reviews or checks, or wants review-bot findings addressed until the PR is clean.
---

# PR watch

Invoke as `/pr-watch [PR number|URL] [--reviewer <login>]... [--request-comment "<text>"] [--max-repairs N]`. With no PR argument, use the PR for the current branch from `gh pr view`. Default repair budget is 10.

The loop is: observe the PR with the gate script, repair what it reports, republish, observe again. The gate never mutates GitHub; every push and comment is yours and is deliberate.

## Configure reviewers

A reviewer is any account that reviews PRs in this repository: a bot such as Codex, CodeRabbit, Copilot, or Claude, or a human the user names. Resolve the list in this order and use the first that yields anything:

1. `--reviewer` flags on the invocation.
2. A `pr-watch` section in `AGENTS.md` or `CLAUDE.md` naming reviewer logins and, optionally, the request comment.
3. Reviewer logins observed on recent merged PRs: `gh pr list --state merged --limit 5` then `gh pr view <n> --json reviews,comments`.
4. None. The gate then requires only green checks and zero unresolved threads.

`--request-comment` is the exact comment that asks a bot to review, for example `@codex review`. Post it at most once per HEAD, and only when the gate reports the reviewer has not covered the current HEAD.

## Watch loop

1. Pin the expected HEAD: `git rev-parse HEAD` must equal the PR's `headRefOid`. If they differ, push or stop; never watch a HEAD you did not verify.
2. Run the gate from this skill's directory:

```bash
node "$SKILL_DIR/scripts/pr-gate.mjs" --repo "$OWNER/$REPO" --pr "$PR_NUMBER" \
  --expected-head "$HEAD_SHA" [--reviewer <login>]... [--request-comment "<text>"] \
  --watch --json
```

   Exit `0` is ready, `1` is pending or timed out, `2` is blocked. Each JSON line is `{ state, reasons, threads }`; `threads` lists unresolved review threads with path, line, author, and body.
3. On `pending` with "has not reviewed the current HEAD" for a reviewer that takes a request comment, post the request once with `gh pr comment`, note the HEAD it was posted for, and watch again.
4. On `pending` timeout, report the last reasons and stop. Waiting longer is the user's call.
5. On `blocked`, classify each reason:
   - **Failed check**: read the log with `gh run view --log-failed`, fix the cause locally.
   - **Unresolved thread**: read the full thread with `gh api graphql` or `gh pr view --comments`, verify the finding against the code, fix it or reply with why it is wrong. Resolve a thread only after its fix is pushed or its rejection is posted.
   - **Changes requested by a human**: address the review, then re-request review with `gh pr edit --add-reviewer`. Never dismiss a human review.
   - **Merge conflict or wrong base**: rebase onto the live base, rerun the project's tests, and push with `--force-with-lease`.
   - **Draft, closed, or mismatched HEAD**: stop and report; these are not repairs.
6. A repair that changes code counts one against the budget. Hand the repaired tree to `/apr --no-watch`; it runs the focused tests, autoreview, commit, and push once, without a nested watch loop. Return to step 1 with the new HEAD.
7. When the budget is exhausted, stop with a report of what remains open.

**Complete when:** the gate exits `0` for the exact current HEAD, or the budget or timeout is exhausted and the report lists every reason still open.

## Report

- PR URL and final HEAD SHA
- Gate result and the reviewers it required
- Repairs made (count, and one line per finding with its source thread/check link, reviewed HEAD, and repair commit so `/promote` can consume them)
- Findings consciously rejected, with the reply posted
- Reasons still open, if any
