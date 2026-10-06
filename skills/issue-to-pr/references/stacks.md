# Stacks

A stacked run adds one layer on top of an open stack of PRs. Its base is the top PR's head, and its PR targets the top PR's head branch.

## Find and pin the stack

The checkout is usually a fresh worktree on the default branch, so the current branch need not have a PR.

1. List candidates with `gh pr list --state open --json number,url,title,headRefName,baseRefName,headRefOid`. Chain each PR whose `baseRefName` is another open PR's `headRefName`. A chain is a stack, and its top is the PR whose head branch is no other PR's base. A lone open PR is a one-layer stack.
2. Pick the stack the `stack` argument names: a PR in the chain, its URL, or a stack number. Without an argument, take the only chain. With several chains, take the one the work item names by PR or branch, or ask once, listing each chain by its top PR's title.
3. The top PR is the predecessor. Run `git fetch origin <top headRefName>`. The base ref is `refs/remotes/origin/<top headRefName>`, and its SHA must equal the PR's `headRefOid`. When they differ, or the top PR is not open, stop as blocked.

**Complete when:** the record holds `predecessor_pr`, `base_ref` and a `base_sha` equal to the predecessor's `headRefOid`.

## Branch

Create the layer with `git checkout -b <branch> <base_sha>` and record `stack_tracking: none`. Use `gh stack` only when this checkout already tracks the stack, meaning `gh stack view` lists the predecessor's branch. Then run `gh stack add <branch>` instead and record `stack_tracking: gh-stack`.

## Publish

Pass `stack <predecessor PR URL>` to `/apr`. It opens the PR with `gh pr create --base <predecessor head branch>`, or with `gh stack submit --open` when the stack is tracked. Then check two things:

- `gh pr view --json baseRefName` names the predecessor's head branch, not the default branch.
- `gh pr view --json changedFiles` equals `git diff --name-only <base_sha>...HEAD | wc -l`. #447 grew from 9 to 100 files without anyone noticing.

Either mismatch stops the run as blocked, with both values in the report. Run the same two checks after every later push to the layer.

## After publishing

A stack merges bottom up through `/ship land <bottom PR>`, one verified and approved layer at a time. With `--merge`, this skill lands a layer only once it is the bottom of its stack, as stage 7 describes. When the predecessor moves or merges, follow the predecessor case in [resume](resume.md).
