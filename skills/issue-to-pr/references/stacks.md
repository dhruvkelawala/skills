# Stacks

A stacked run adds one layer on top of an open stack of PRs. Its base is the top PR's head, and its PR targets the top PR's head branch.

## Find and pin the stack

Stage 1 finds the stack before the build moves into its own worktree, so the current branch need not have a PR.

1. List candidates with `gh pr list --state open --json number,url,title,headRefName,baseRefName,headRefOid` (REST: `gh api --paginate "repos/{owner}/{repo}/pulls?state=open&per_page=100"`, where those fields are `.number`, `.html_url`, `.title`, `.head.ref`, `.base.ref` and `.head.sha`). Chain each PR whose `baseRefName` is another open PR's `headRefName`. A chain is a stack, and its top is the PR whose head branch is no other PR's base. A lone open PR is a one-layer stack.
2. Pick the stack the `stack` argument names: a PR in the chain, its URL, or a stack number. Without an argument, take the only chain. With several chains, take the one the work item names by PR or branch, or ask once, listing each chain by its top PR's title.
3. The top PR is the predecessor. A build started with `--spec` is the exception: its predecessor is the PR `stack` names, even when other layers already sit on it, because a spec's tickets form a tree, and two tickets blocked by the same ticket both stack on its PR. Run `git fetch origin <predecessor headRefName>`. The base ref is `refs/remotes/origin/<predecessor headRefName>`, and its SHA must equal the predecessor's `headRefOid`. When they differ, or the predecessor is not open, stop as blocked.

**Complete when:** the record holds `predecessor_pr`, `base_ref` and a `base_sha` equal to the predecessor's `headRefOid`.

## Branch

T3 creates the layer's branch with its worktree, from the predecessor's head branch, in stage 1 step 3. Record `stack_tracking: none`, even when another checkout tracks the stack with `gh stack`, because `gh stack add` would create a second branch.

## Publish

Pass `stack <predecessor PR URL>` to `/apr`. It opens the PR with `gh pr create --base <predecessor head branch>`, or its REST fallback, or with `gh stack submit --open` when the stack is tracked. Then check two things, through `gh pr view` or, on a rate limit, REST's `gh api repos/{owner}/{repo}/pulls/<n>`:

- `gh pr view --json baseRefName` (REST: `.base.ref`) names the predecessor's head branch, not the default branch.
- `gh pr view --json changedFiles` (REST: `.changed_files`) equals `git diff --name-only <base_sha>...HEAD | wc -l`. #447 grew from 9 to 100 files without anyone noticing.

Either mismatch stops the run as blocked, with both values in the report. Run the same two checks after every later push to the layer.

## After publishing

A stack merges bottom up through `/ship land <bottom PR>`, one verified and approved layer at a time. With `--merge`, this skill lands a layer only once it is the bottom of its stack, as stage 7 describes. When the predecessor moves or merges, follow the predecessor case in [resume](resume.md).
