# ship queue, before (8079158) and after (1377ca7)

## Before, at 8079158

```console
$ node skills/ship/scripts/ship.mjs queue --repo dhruvkelawala/skills
MERGE NOW (0)
REVIEW (0), highest unblock first, then smallest
WAITING ON PARENT (0)
YOURS, NOT MERGED (3)
  #92   NONE              unblocks 1     193 lines  two-way  feat(pr-review): the tour lives in T3's Guide tab
  #93   NONE              unblocks 0     299 lines  two-way  feat(issue-to-pr): your PR's review happens in its build thread
  #91   NONE              unblocks 0     643 lines  two-way  feat(issue-to-pr): build a spec as a stack of PRs, or as one PR 
# exit 0

$ git show 8079158:skills/ship/SKILL.md | sed -n 3p
description: Order the PR review queue, get an independent verdict on a risky PR, and land a PR or a stack bottom up, one PR at a time, pinned to the checked head. Use when the user invokes /ship, says "land" or `verify` on a PR, asks what to review or merge next, or wants a PR or stack landed.
```

## After, at 1377ca7

```console
$ node skills/ship/scripts/ship.mjs queue --repo dhruvkelawala/skills
ship: usage: ship.mjs verdict record|check | run <bottom-pr> | merge <pr> --head <sha>
# exit 2

$ sed -n 3p skills/ship/SKILL.md
description: Get an independent verdict on a risky PR, and land a PR or a stack bottom up, one PR at a time, pinned to the checked head. Use when the user invokes /ship, says "land" or `verify` on a PR, or wants a PR or stack landed.

$ git grep -n -E "ship queue|planQueue|textQueue" -- skills README.md
# exit 1 (no match)

$ node --test skills/ship/scripts/ship.test.mjs skills/ship/scripts/ship.cli.test.mjs
ℹ tests 49
ℹ pass 49
ℹ fail 0
```
