---
name: worktree-cleanup
description: Use when the user invokes /worktree-cleanup or asks to reclaim space from Git worktrees or iOS simulators. Audits everything read-only, sorts it into buckets the user approves by name, and keeps anything that could lose work on a hold list. Branch deletion is a separate approval.
---

# Worktree cleanup

The user approves buckets, not single worktrees, for example "remove merged and pr-merged". Anything that could lose work goes on a hold list, and a held item is removed only when the user names it.

## 1. Audit worktrees

Record `df -h /`, then run the audit over the folder that holds the repos, or over one repo:

```bash
bash <skill-dir>/scripts/worktree-audit.sh <code-root or repo>
```

The script is read-only. It prints a header and one tab-separated row per worktree, including `MERGED` (HEAD is in the default branch), the dirty counts, a suggested `BUCKET` and the `HEAD` SHA. Its stderr names repos whose remote it could not read.

Then gather two kinds of evidence in bulk:

- Merged PRs. For each repo, run `gh pr list --repo <owner/name> --state merged --limit 1000 --json number,headRefName,headRefOid`. A worktree has PR evidence when a merged PR's `headRefOid` equals its HEAD. This finds squash merges and deleted remote branches, which the `MERGED` column misses.
- In use. List the working directories of running processes and of agent sessions active in the last day:

  ```bash
  lsof -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | sort -u
  find ~/.claude/projects ~/.pi/agent/sessions ~/.codex/sessions -name '*.jsonl' -mtime -1 -print0 2>/dev/null \
    | xargs -0 grep -ho '"cwd":"[^"]*"' | sort -u
  ```

  A worktree is in use when either list holds its path or a path inside it, or when the user says so.

Complete when every worktree has a row or a named audit error, and the PR and use checks covered every repo.

## 2. Audit simulators

When `xcrun simctl help` fails, note that the simulator audit is unavailable and move on. Otherwise read `xcrun simctl list devices`, `xcrun simctl --set testing list devices` and `xcrun simctl runtime list`. Hold booted devices.

Complete when every device and runtime is in a bucket or held, or the audit is noted as unavailable.

## 3. Propose buckets

| Bucket | Contents |
| --- | --- |
| `merged` | Worktrees the script marks `CANDIDATE-CHECK-USAGE` (no changes, nothing unpushed, HEAD in the default branch) that are not in use |
| `pr-merged` | Worktrees with zero tracked and untracked changes, PR evidence, and no primary, locked or in-use flag |
| `unavailable` | Simulator devices whose runtime is gone |
| `test-clones` | Simulator devices in the testing set |
| `unused-runtimes` | Simulator runtimes that no remaining device uses |

Every other worktree goes on the hold list with one reason: primary, locked, in use, uncommitted changes, unpushed commits, unmerged with no PR evidence, or unknown state.

For each bucket, show the count and the total size where it can be measured. For worktree buckets, also name the ignored files that removal would delete beyond dependencies and build output, such as `.env` files (`git -C <path> ls-files -o -i --exclude-standard --directory`). Show the hold list grouped by reason, with paths. Ask once which buckets to remove and whether any held paths should go too. For each held path the user names, show its diff, untracked files and unpushed commits, and wait for a yes on that path.

Complete when the user has named the buckets to remove, or named them in the invocation, and has confirmed each held path they want removed.

## 4. Remove

Work through the approved items one at a time. Just before each worktree removal, recheck its status, HEAD and use. An item whose evidence changed moves to the hold list, and the run continues.

```bash
git -C <repo> worktree remove -- <path>
```

Take `<path>` from git's own worktree list. When git refuses, for example because changes appeared, hold the item with git's message and continue. Use `--force` only on a held path the user confirmed. A locked worktree stays until the user unlocks it. Leave every other registration as it is, with no `rm -rf` fallback and no `git worktree prune`.

Delete each approved simulator item by its own ID, so the deletion matches the list the user saw: `xcrun simctl [--set testing] delete <UDID>` or `xcrun simctl runtime delete <ID>`. Never use `delete all` or `delete unavailable`.

Complete when every approved item is removed or on the hold list with a reason.

## 5. Offer branch deletion

Branches stay unless the user approves deleting them in a separate answer. List the local branches of removed worktrees in two groups: merged branches, deleted with `git branch -d`, and PR-merged branches, deleted with `git branch -D`, which is safe because the merged PR keeps the commits. Delete only the groups the user approves.

Complete when the user has answered, and each approved branch is deleted or reported with its error.

## Report

- `df -h /` before and after.
- Removed count and size per bucket, and branches deleted.
- The hold list, grouped by reason.
- Simulator results, or why the simulator audit was unavailable.

On an audit-only run, say that nothing was removed.

Adapted from pstack's worktree-cleanup playbook by Lauren Tan (MIT), cursor/plugins@e5a8186.
