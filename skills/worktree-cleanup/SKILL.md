---
name: worktree-cleanup
description: Audit disk usage, Git worktrees, and stale iOS simulators, then remove only individually approved items. Use when the user invokes /worktree-cleanup or asks to reclaim worktree or simulator space.
---

# Worktree cleanup

## 1. Audit read-only

Record `df -h /`. Resolve this skill's directory, then run:

```bash
bash <skill-dir>/scripts/worktree-audit.sh /Users/sumodeus/code
# Or limit discovery to one repo:
bash <skill-dir>/scripts/worktree-audit.sh <repo-path>
```

The executable script discovers repositories recursively, deduplicates shared Git directories, and gets every worktree path from `git worktree list --porcelain -z`. This covers `<repo>.sumo-worktrees/<branch-slug>/` on `sumo/<slug>`, `/Users/sumodeus/code/worktrees`, and registered paths outside the scan root. For another checkout layout, pass its parent directory.

Rows use shell-quoted repo/worktree paths so whitespace cannot split items. For each repo with multiple worktrees, report the primary checkout too, but exclude it from cleanup candidates. Classify size in KiB, HEAD commit age (not creation/usage age), ancestry into the default branch, tracked/untracked/ignored state, unpushed commits, and remote branch presence. The script queries `ls-remote` read-only; it never fetches or refreshes the index. Cached/local merge bases are labeled on stderr. Missing remote branches are distinguished as previously tracked versus deleted-or-never-pushed; neither means safe. Squash merges require separate PR/commit evidence. `UNKNOWN` and cached-unpublished counts require investigation, not clearance.

**Complete when:** every discovered worktree has a row or a named audit error. Buckets are advice, never approval.

## 2. Check usage and propose items

Ask the user which Pi sessions, agents, or other worktrees are active or pinned; include sibling repro/background trees. Inspect session metadata only when available and relevant. Age, merge status, and a deleted remote branch do not prove inactivity.

For each proposed item show its exact path, branch, size, merge evidence, dirtiness (including ignored artifacts), unpushed/unknown status, usage evidence, and what removal would lose. Show dirty diffs and name untracked files before seeking approval. Preserve locked, primary, and in-use worktrees. Name uncommitted-data loss and unpublished-commit recovery risks explicitly; branch preservation alone is not a backup.

**Complete when:** the user explicitly approves each exact item and operation. A general cleanup request or a `CANDIDATE` bucket is not per-item approval. Branch deletion is a separate approval, never implied by worktree approval.

## 3. Remove only approved items

Immediately recheck status, HEAD, remote/unpushed state, and usage. Changed evidence invalidates approval: ask again. Use `git -C <repo> worktree remove -- <approved-path>` for an approved clean item. If dirty or ignored files block removal, stop; `--force` requires explicit approval naming those losses. Respect locks. Use Git's registered path, not a reconstructed slug.

Preserve branches by default. Only a separately approved, named branch may be deleted; forcing an unmerged branch requires separate risk approval. Stop on command failure: no `rm -rf` fallback, bulk deletion, or automatic prune of unrelated registrations.

## 4. Audit simulators when available

If `xcrun` is absent or `xcrun simctl help` fails, report simulator audit unavailable and continue. Otherwise read `xcrun simctl list devices`, `xcrun simctl --set testing list devices`, and `xcrun simctl runtime list`. Identify unavailable devices, testing clones, and old runtimes; show each name/UDID, state, and runtime, with size only where measurable. Old is not automatically stale. Hold booted or in-use devices.

Require explicit per-device/runtime approval naming app-data loss or runtime impact, then recheck usage and identity. Delete only the approved UDID with `xcrun simctl [--set testing] delete <UDID>` or approved runtime ID with `xcrun simctl runtime delete <ID>`. Never use `delete all` or bulk `delete unavailable`. Package caches, DerivedData, and other unrelated disk cleanup are outside this skill.

## Report

Audit summary and uncertainty; individually approved/removal results (including branches); held items with reasons; simulator availability/results; `df -h /` before and after with observed space reclaimed. For audit-only runs, say **nothing removed** and do not claim reclaimed space.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
