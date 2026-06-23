---
name: apr
description: Run the combined Autoreview and PR publish flow. Use when the user invokes /apr or asks Codex to review local changes, fix accepted findings until clean, commit, push, and open a ready-for-review GitHub pull request.
---

# APR

Run a complete closeout flow: structured autoreview first, then intentional commit, push, and a ready-for-review PR.

## Contract

- Treat this as a composition of `$autoreview` and `$github:yeet`, with these overrides:
  - Run autoreview with Claude by default.
  - If the user invokes `/apr codex`, run autoreview with Codex instead.
  - If the user invokes `/apr claude`, run autoreview with Claude explicitly.
  - When the selected engine is Claude, pass `--model claude-opus-4-8`.
  - Pass the selected engine on every autoreview command.
  - Open a ready-for-review PR, never a draft PR.
  - If a PR already exists for the current branch, update that PR flow by pushing the reviewed changes if they are not already pushed; do not create a duplicate PR.
  - Do not prefix the PR title with `[codex]`.
  - Make the PR title a conventional-commit-style title, for example `fix: handle empty import rows` or `feat: add billing export`.
- Keep review quality higher priority than publishing speed.
- Never stage unrelated user changes silently.
- Do not push if review still has accepted/actionable findings unless the user explicitly overrides after seeing the risk.
- Do not switch review engines if the selected engine is slow or at capacity; retry the selected engine a few times and report the blocker if it cannot complete.

## Workflow

1. Inspect scope.
   - Run `git status -sb` and inspect the diff before staging.
   - If the worktree is mixed, ask which files belong in the PR.
   - If the checkout is not a git repo or lacks an accessible GitHub remote, stop and explain the blocker.

2. Check GitHub readiness.
   - Run `gh --version`.
   - Run `gh auth status`.
   - If `gh` is missing or unauthenticated, ask the user to install or authenticate before continuing.

3. Pick branch strategy.
   - If on `main`, `master`, or the repository default branch, create `codex/{short-description}`.
   - Otherwise stay on the current branch unless the user asks for a new one.
   - Use a short lowercase hyphenated branch suffix derived from the intended change.

4. Run validation and autoreview before publishing.
   - Select the review engine from the invocation:
     - `/apr` means `claude`.
     - `/apr claude` means `claude`.
     - `/apr codex` means `codex`.
   - If the user passes any other engine name, stop and ask whether they meant `claude` or `codex`.
   - If the selected engine is `claude`, set `model_args="--model claude-opus-4-8"`.
   - If the selected engine is `codex`, leave `model_args` empty unless the user explicitly requested a model.
   - Run relevant formatters/tests first when they are obvious from the repo.
   - Run the autoreview helper on the current patch:

```bash
<autoreview-helper> --mode local --engine <selected-engine> <model_args>
```

   - If the work is already committed on the branch, review the branch instead:

```bash
<autoreview-helper> --mode branch --base origin/<base-branch> --engine <selected-engine> <model_args>
```

   - Verify every accepted finding against the real code before fixing it.
   - If a review fix changes code, rerun focused tests and rerun autoreview.
   - Continue until autoreview exits cleanly with no accepted/actionable findings.

5. Stage and commit intentionally.
   - Stage only the files in scope.
   - Use a conventional commit subject for the commit, matching the PR title unless there is a good reason to differ.
   - Prefer one of `fix:`, `feat:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`, `build:`, or `ci:`.

6. Push the branch.
   - Before creating a PR, check whether one already exists for the current branch:

```bash
gh pr view --json url,state,baseRefName,headRefName,title
```

   - If a PR already exists, push the reviewed commit(s) if they are not already on the remote, then skip PR creation.

```bash
git push -u origin "$(git branch --show-current)"
```

7. Open the PR ready for review.
   - Skip this step when `gh pr view` found an existing PR for the current branch.
   - Prefer the GitHub app from the GitHub plugin when available.
   - Derive repository, head branch, and base branch from `gh repo view`, `git branch --show-current`, and the user request or remote default branch.
   - Set the PR title to the conventional commit subject exactly, with no `[codex]` prefix.
   - Do not set draft mode.
   - If falling back to the CLI, use `gh pr create` without `--draft`:

```bash
gh pr create --title "$title" --body-file "$body_file" --head "$(git branch --show-current)" --base "$base"
```

## PR Body

Write real Markdown prose with:

- What changed
- Why it changed
- User or developer impact
- Root cause, when the PR fixes a bug
- Tests and autoreview command used

## Final Report

Include:

- Branch name
- Commit SHA and subject
- PR URL and base branch
- Tests/proof run
- Autoreview command and clean result
- Any accepted findings fixed or consciously rejected
