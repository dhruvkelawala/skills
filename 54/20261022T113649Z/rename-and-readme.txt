# Rename at 1302a12
$ git show 4a345b2:skills/worktree-cleanup/SKILL.md | sed -n 2,3p   (before)
name: worktree-cleanup
description: Use when the user invokes /worktree-cleanup or asks to reclaim space from Git worktrees or iOS simulators. Audits everything read-only, sorts it into buckets the user approves by name, and keeps anything that could lose work on a hold list. Branch deletion is a separate approval.
$ ls skills | grep cleanup
cleanup
$ sed -n 2,3p skills/cleanup/SKILL.md   (after)
name: cleanup
description: Use when the user invokes /cleanup or /worktree-cleanup, says the disk is low or full, asks to clean up or free space on the machine, or asks to reclaim space from Git worktrees, iOS simulators, build artifacts or package-manager caches. Audits everything read-only, sorts it into buckets the user approves by name, and keeps anything that could lose work on a hold list. Branch deletion is a separate approval.
$ git grep -n worktree-cleanup
skills/cleanup/SKILL.md:3:description: Use when the user invokes /cleanup or /worktree-cleanup, says the disk is low or full, asks to clean up or free space on the machine, or asks to reclaim space from Git worktrees, iOS simulators, build artifacts or package-manager caches. Audits everything read-only, sorts it into buckets the user approves by name, and keeps anything that could lose work on a hold list. Branch deletion is a separate approval.
skills/cleanup/SKILL.md:121:Adapted from pstack's worktree-cleanup playbook by Lauren Tan (MIT), cursor/plugins@e5a8186.

# README row
$ git show 4a345b2:README.md | grep worktree-cleanup   (before)
| [worktree-cleanup](skills/worktree-cleanup/SKILL.md) | Read-only audit of git worktrees and iOS simulators, then removal by approved bucket, with a hold list for anything that could lose work. Branch deletion is a separate approval. (pstack) |
$ grep -n '\[cleanup\]' README.md   (after)
9:| [cleanup](skills/cleanup/SKILL.md) | Free disk space: a read-only audit of Git worktrees, iOS simulators, build artifacts and package-manager caches, then removal by approved bucket, with a hold list for anything that could lose work. `audit` stops after the proposal and can run as a Saturday scheduled task. (pstack) |
