---
name: apr
description: Use when the user invokes /apr, /apr claude or /apr --skip-review, asks to review and publish local changes, or when /issue-to-pr or /pr-watch reaches its publish step. Autoreviews from a pinned base, commits, pushes, opens or updates a ready-for-review GitHub PR, standalone or as a stacked layer, then watches it with /pr-watch until CI and reviewers are clean. Its thread then owns the PR until it merges.
---

# APR

apr runs autoreview first, then makes an intentional commit, pushes, opens a ready-for-review PR, and watches it while CI and PR reviewers report findings. It pushes nothing while an accepted review finding is open.

Invoke as `/apr [claude|codex] [--skip-review] [--base <ref or sha>] [stack [<predecessor PR URL>]] [--no-watch] [--max-repairs N] [--body-file <path>] [--run-record <path>]`.

- The engine comes from the `second-opinion` job in the models file (step 1). By default it is that job's entry for this thread. `claude` or `codex` picks the entry with that engine. Anything else stops with a question.
- `--skip-review` skips autoreview. The report then says so and claims no clean result.
- `--base` pins the review range and the PR base. `/issue-to-pr` passes its `base_sha`.
- `stack [<predecessor PR URL>]` publishes the current branch as a layer on that PR. Without a URL, apr treats the branch as stacked when `gh stack view` succeeds and lists it, and takes the branch below it as the predecessor.
- `--no-watch` stops after the PR is published. `/issue-to-pr` and `/pr-watch` pass it because they own the watch themselves.
- `--max-repairs` is the PR's repair budget, for its whole life, as [the PR's thread](#the-prs-thread) counts it. The default is 10.
- `--body-file` supplies a prepared PR body. apr uses it as written apart from filling the autoreview line. `/issue-to-pr` passes one built from its template.
- `--run-record` names an `/issue-to-pr` run record. When it holds a clean autoreview for the current tree, step 4 reuses that result instead of reviewing again.

## 1. Resolve inputs once

1. **Helper.** The review helper is the `autoreview` script. Resolve the first that exists and keep it as `$AUTOREVIEW`:
   `.agents/skills/autoreview/scripts/autoreview`, `.claude/skills/autoreview/scripts/autoreview`, `$AGENTS_HOME/skills/autoreview/scripts/autoreview`, `~/.agents/skills/autoreview/scripts/autoreview`, `~/.claude/skills/autoreview/scripts/autoreview`. If none exists and review was not skipped, stop, because autoreview is required and an inline review cannot replace it.
2. **Engine and model.** Read the `second-opinion` job from the models file, `models.json` in the real directory that holds this skill's folder (`cd -P <this skill's folder>/.. && pwd`). The chosen entry gives `--model <model>`, plus `--thinking <effort>` when it names an effort. A model or effort the user names replaces these. Keep the flags as `$ENGINE_FLAGS`. The engine and model stay fixed for the whole run. On capacity, rate-limit or latency errors, retry the same command up to three times, then report the blocker. Only the helper's own documented account-access retry may change the model. That retry cannot be switched off, and the helper announces it on stderr as `retrying with <model>`. The model it ran is that one when the line appears, and otherwise the one on its `model:` line.
3. **Base.** `--base` if given. Otherwise the predecessor branch's remote-tracking ref when stacked, else the remote default branch from `gh repo view --json defaultBranchRef` (REST: `gh api repos/{owner}/{repo} --jq .default_branch`). Record the resolved base SHA with `git rev-parse`.
4. **GitHub.** `gh --version` and `gh auth status` must succeed, and `git remote get-url origin` must point at an accessible GitHub repository. Otherwise stop and name the blocker. `gh pr` and `gh repo view` spend the GraphQL quota that every agent on the account shares. When one fails with `API rate limit exceeded` or `RATE_LIMITED`, run the REST call named beside it, which draws on a separate quota. `gh api` fills `{owner}`, `{repo}` and `{branch}` from the current checkout.

## 2. Confirm scope

Run `git status -sb` and read the diff. If the worktree mixes this change with unrelated files, ask which files belong in the PR, and stage only those. If nothing is changed and nothing is unpushed, stop, because there is nothing to publish.

## 3. Branch

On `main`, `master` or the default branch, create `<type>/<short-description>` with a conventional-commit type, for example `fix/handle-empty-import-rows`. On a feature branch, stay. In `stack` mode with no stack yet, run `gh stack init` on the trunk first, then `gh stack add <branch>`.

## 4. Verify and review

1. Run `/verify` in focused mode, or the project's obvious formatter and focused tests when it is unavailable. Skip this when the exact current HEAD already has a `/verify` result from earlier in this session, as it does when `/issue-to-pr` or `/pr-watch` calls in.
2. With `--run-record`, read its `autoreview` line. When the result is clean, its tree equals `git rev-parse HEAD^{tree}`, and `git status --porcelain` prints nothing (no staged, unstaged or untracked changes), skip the helper and carry that engine, model and result into the report and the PR body. `/issue-to-pr` runs autoreview once in its own review stage, and this keeps apr from repeating it.
3. Otherwise, unless review was skipped, review the exact change with the helper. Uncommitted work:

```bash
"$AUTOREVIEW" --mode local --engine <engine> $ENGINE_FLAGS --max-priority P1
```

   Committed work on the branch:

```bash
"$AUTOREVIEW" --mode branch --base <base-sha> --engine <engine> $ENGINE_FLAGS --max-priority P1
```

4. Check every finding against the real code. Fix accepted findings, rerun the focused tests, and rerun the same helper command. Reject a finding only with a stated reason.
5. Heartbeat lines mean the helper is still working. Give a review at least thirty minutes before stopping it.

**Complete when:** the helper exits 0 with no accepted or actionable findings for the current tree, the run record holds a clean autoreview for the current tree, or review was skipped by flag.

## 5. Commit

Stage only the in-scope files. Commit with a subject that will also be the PR title, written as the `pr` skill's [title](../pr/SKILL.md#the-title) says. Follow the repository's own rule on AI attribution trailers.

## 6. Push and publish

Check for an existing PR first: `gh pr view --json url,state,baseRefName,headRefOid` (REST: `gh api "repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all"`, an empty list when there is none).

- **Stacked, tracked locally** (`gh stack view` lists the branch): `gh stack push`, then `gh stack submit --open` to create or update every PR in the stack as ready for review.
- **Stacked, not tracked** (a branch created outside gh stack, common in a fresh worktree): `git push -u origin "$(git branch --show-current)"`, then create the PR with the predecessor's head branch as its base, or update the existing one:

```bash
gh pr create --title "$title" --body-file "$body_file" --head "$(git branch --show-current)" --base "$predecessor_head_branch"
# REST, on a rate-limit error:
gh api -X POST repos/{owner}/{repo}/pulls -f title="$title" -F body=@"$body_file" -f head="$(git branch --show-current)" -f base="$predecessor_head_branch"
```

- For both, confirm with `gh pr view --json baseRefName` (REST: `.base.ref` from `gh api repos/{owner}/{repo}/pulls/<n>`) that this branch's PR targets the predecessor branch, not the trunk. If it targets the trunk, stop and report.
- **Standalone, no PR yet:** `git push -u origin "$(git branch --show-current)"`, then:

```bash
gh pr create --title "$title" --body-file "$body_file" --head "$(git branch --show-current)" --base "$base_branch"
# REST, on a rate-limit error:
gh api -X POST repos/{owner}/{repo}/pulls -f title="$title" -F body=@"$body_file" -f head="$(git branch --show-current)" -f base="$base_branch"
```

- **Standalone, PR exists:** push the new commits and update the body with `gh pr edit --body-file` (REST: `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -F body=@"$body_file"`). Update the existing PR rather than opening a second one.

Open every PR ready for review, not as a draft, and with no `[codex]` or other tag in the title.

**Complete when:** `gh pr view --json headRefOid` (REST: `.head.sha` from `gh api repos/{owner}/{repo}/pulls/<n>`) equals the local HEAD and the PR is open and ready for review.

## 7. Watch and repair

Skip with `--no-watch`. Otherwise load and follow `/pr-watch <PR URL> --max-repairs <budget left> --run-record <record>` for this PR, with the budget left in the run record. It resolves reviewers, the request comment and ignored checks from its own configuration, and it hands each repair back to `/apr --no-watch`.

**Complete when:** `/pr-watch` reports the gate exiting `0` for the current HEAD, or reports the budget or timeout spent with every reason still open.

## The PR's thread

This thread owns the PR it published until the PR merges. The words the user says here ("land", "post", "more", "go on", `try` and `verify`), the fixes it makes on its own, the repair budget, the watch and the cleanup on merge follow [the PR's thread](../issue-to-pr/references/pr-thread.md), as in a build's thread.

When `/issue-to-pr` calls apr, the build's run record holds them. Otherwise the run record is pr-watch's, `~/.agent/pr-watch/<owner>/<repo>/<pr>.md`. Once the PR exists, start the record with this header and a blank line, unless it already has one, for the scripts that page names:

```md
pr: <PR URL>
base_ref: refs/remotes/origin/<base branch>
repairs: 0/<budget>
```

## PR body

With `--body-file`, use the supplied body. When step 4 ran or reused a review, set the body's autoreview line to that engine, the model it ran (step 1) and the result. With `--skip-review`, leave the line as supplied. Otherwise load the `pr` skill and fill its template: the problem and the change, Evidence before and after, a Proof paragraph that names the verification and autoreview commands that passed, rather than "tests pass", and the door and the blast radius. For a fix, name the root cause in the opening.

Before step 6 sends a body, check it with `node <this skill's folder>/../pr-watch/scripts/secrets.mjs < <body file>`. When it exits 1, put each secret's variable in its place, as its output says, and check again.

## Report

- Branch, commit SHA and subject
- PR URL, base branch, and whether it is a stack layer
- Tests run
- Autoreview engine, the model it ran (step 1), the command with `$ENGINE_FLAGS` filled in, and the clean result; the clean result reused from `--run-record` with its engine and model; or `review skipped by --skip-review`
- `/pr-watch`'s gate result, the reviewers it required and the repairs it made against the budget, or `watch skipped by --no-watch`
- Findings fixed, and findings rejected with the reason
