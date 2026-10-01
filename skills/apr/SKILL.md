---
name: apr
description: Autoreview, commit, push, open or update a ready-for-review GitHub pull request, then watch it and repair PR review findings until CI and reviewers are clean. Standalone or a gh stack layer, reviewing from a pinned base. Use when the user invokes /apr, /apr claude, /apr --skip-review, asks to review and publish local changes, or when /issue-to-pr or /pr-watch reaches its publish step.
---

# APR

Autoreview first, then an intentional commit, push, a ready-for-review PR, and a watch loop that repairs what CI and PR reviewers report. Review quality outranks publishing speed: nothing is pushed while an accepted finding is open.

Invoke as `/apr [claude|codex] [--skip-review] [--base <ref or sha>] [stack [<predecessor PR URL>]] [--no-watch] [--max-repairs N] [--body-file <path>]`.

- Engine defaults to `codex`, matching autoreview's own order (OpenAI through Codex before Claude). `claude` selects Claude. Anything else stops with a question.
- `--skip-review` skips autoreview. The report then says so and claims no clean result.
- `--base` pins the review range and the PR base. `/issue-to-pr` passes its `base_sha`.
- `stack [<predecessor PR URL>]` publishes the current branch as a layer on that PR. Without a URL, stacking is detected: the branch is stacked when `gh stack view` succeeds and lists it, and its predecessor is the branch below it.
- `--no-watch` stops after the PR is published. `/issue-to-pr` and `/pr-watch` pass it because they own the watch loop themselves.
- `--max-repairs` bounds the watch loop. Default is 10.
- `--body-file` supplies a prepared PR body. apr uses it verbatim apart from filling the autoreview line, instead of writing its own. `/issue-to-pr` passes one built from its template.

## 1. Resolve inputs once

1. **Helper.** The review helper is the `autoreview` script. Resolve the first that exists and keep it as `$AUTOREVIEW`:
   `.agents/skills/autoreview/scripts/autoreview`, `.claude/skills/autoreview/scripts/autoreview`, `$AGENTS_HOME/skills/autoreview/scripts/autoreview`, `~/.agents/skills/autoreview/scripts/autoreview`, `~/.claude/skills/autoreview/scripts/autoreview`. If none exists and review was not skipped, stop: autoreview is required and cannot be replaced by an inline review.
2. **Engine and model.** `codex` runs with `--model gpt-6.1-sol --thinking xhigh`; `claude` runs with `--model claude-sonnet-5-5`. A model or effort the user names replaces these. Keep the pair as `$ENGINE_FLAGS`. The chosen engine and model stay fixed for the whole run: on capacity, rate-limit, or latency errors retry the same command up to three times, then report the blocker. Only the helper's own documented account-access fallback may change the model.
3. **Base.** `--base` if given. Otherwise the predecessor branch's remote-tracking ref when stacked, else the remote default branch from `gh repo view --json defaultBranchRef`. Record the resolved base SHA with `git rev-parse`.
4. **GitHub.** `gh --version` and `gh auth status` must succeed, and `git remote get-url origin` must point at an accessible GitHub repository. Otherwise stop and name the blocker.

## 2. Confirm scope

Run `git status -sb` and read the diff. If the worktree mixes this change with unrelated files, ask which files belong in the PR; never stage the rest. If nothing is changed and nothing is unpushed, stop: there is nothing to publish.

## 3. Branch

On `main`, `master`, or the default branch, create `<type>/<short-description>` with a conventional-commit type, for example `fix/handle-empty-import-rows`. On a feature branch, stay. In `stack` mode with no stack yet, run `gh stack init` on the trunk first, then `gh stack add <branch>`.

## 4. Verify and review

1. Run `/verify` in focused mode, or the project's obvious formatter and focused tests when it is unavailable. Skip this when the exact current HEAD already has a `/verify` result from earlier in this session, as it does when `/issue-to-pr` or `/pr-watch` calls in.
2. Unless skipped, review the exact change with the helper. In the `/issue-to-pr` path this is deliberately a second opinion after `/code-review`: a different engine family reading the same base-to-HEAD diff once. Uncommitted work:

```bash
"$AUTOREVIEW" --mode local --engine <engine> $ENGINE_FLAGS --max-priority P1
```

   Committed work on the branch:

```bash
"$AUTOREVIEW" --mode branch --base <base-sha> --engine <engine> $ENGINE_FLAGS --max-priority P1
```

3. Verify every finding against the real code. Fix accepted findings, rerun the focused tests, rerun the same helper command. Reject a finding only with a stated reason.
4. Heartbeat lines from the helper mean it is working. Do not kill a review under thirty minutes.

**Complete when:** the helper exits 0 with no accepted or actionable findings for the current tree, or review was skipped by flag.

## 5. Commit

Stage only the in-scope files. Commit with a conventional-commit subject that will also be the PR title. Follow the repository's own rule on AI attribution trailers.

## 6. Push and publish

Check for an existing PR first: `gh pr view --json url,state,baseRefName,headRefOid`.

- **Stacked, tracked locally** (`gh stack view` lists the branch): `gh stack push`, then `gh stack submit --open` to create or update every PR in the stack as ready for review.
- **Stacked, not tracked** (branch created outside gh stack, common in a fresh worktree): `git push -u origin "$(git branch --show-current)"`, then `gh stack link <predecessor PR URL> "$(git branch --show-current)" --open`, which creates or updates the PR with the predecessor's head branch as base and joins the stack on GitHub without local tracking.
- For both, confirm with `gh pr view --json baseRefName` that this branch's PR targets the predecessor branch, not the trunk. If it targets the trunk, stop and report.
- **Standalone, no PR yet:** `git push -u origin "$(git branch --show-current)"`, then:

```bash
gh pr create --title "$title" --body-file "$body_file" --head "$(git branch --show-current)" --base "$base_branch"
```

- **Standalone, PR exists:** push the new commits and update the body with `gh pr edit --body-file`. Never open a duplicate.

Always ready for review, never draft. No `[codex]` or other tag in the title.

**Complete when:** `gh pr view --json headRefOid` equals the local HEAD and the PR is open and non-draft.

## 7. Watch and repair

Skip with `--no-watch`. Otherwise loop until the PR is clean or the budget is spent:

1. Run the gate from `/pr-watch`, configuring reviewers the way that skill describes:

```bash
node "$PR_WATCH_DIR/scripts/pr-gate.mjs" --repo "$OWNER/$REPO" --pr "$PR_NUMBER" \
  --expected-head "$(git rev-parse HEAD)" [--reviewer <login>]... [--request-comment "<text>"] --watch --json
```

2. Exit `0`: the PR is clean. Stop.
3. Exit `1` (timeout): report the open reasons and stop. Waiting longer is the user's call.
4. Exit `2` (blocked): classify each reason as `/pr-watch` does. Failed checks and unresolved threads are repairs; a draft, closed, or mismatched-HEAD PR is a stop. For each repair, verify the finding against the code, fix it or reply with why it is wrong, and resolve the thread only after the fix is pushed or the rejection is posted.
5. A repair that changed code counts one against the budget. Rerun step 4 in branch mode from the same base, then step 5 and step 6 to push and update the PR, then return to step 1 with the new HEAD.

**Complete when:** the gate exits `0` for the current HEAD, or the budget or timeout is exhausted and the report lists every reason still open.

## PR body

With `--body-file`, use the supplied body and set its autoreview line to the engine, model, and result from step 4. Otherwise write real Markdown prose, in this order: what changed, why, user or developer impact, root cause when the PR fixes a bug, and the verification and autoreview command used, with exact commands and their results rather than "tests pass".

## Report

- Branch, commit SHA and subject
- PR URL, base branch, and whether it is a stack layer
- Tests run
- Autoreview command and clean result, or `review skipped by --skip-review`
- Gate result, reviewers required, and repairs made against the budget, or `watch skipped by --no-watch`
- Findings fixed, and findings rejected with the reason
