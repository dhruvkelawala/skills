# The PR's thread

A thread that publishes a PR owns it until the PR merges. That covers a build's thread, a spec's thread and a thread where `/apr` published, and these rules hold in each one. The run record is the build's record or, in an `/apr` thread, the record apr starts. `<issue-to-pr>` below is the folder that holds this file's `references` folder.

## Words

The user says these in the thread, and only the user's word starts each one.

| Word | What the thread does |
| --- | --- |
| "land" | Lands the PR through `ship land`, squashed and pinned to the checked head. Said before the PR is clean, it waits, as [below](#land) says. |
| "post" | Sends the replies to people that pr-watch holds, as pr-watch's "post" section says. |
| "more" | Adds 10 repairs to the [repair budget](#repair-budget), then goes on where the run stopped. |
| "go on" | Restarts a stopped run: `/issue-to-pr <n> resume` in a build's thread, and the pr-watch loop in an `/apr` thread. |
| `try` | Runs the PR for the user to test by hand, as [below](#try) says. |
| `verify` | Runs `/ship verify <n>` on the PR, as in a review sitting. From then on rule B covers the PR, so it lands only on a passing verdict for its current patch. |

## "land"

When the user says "land", hold it first, tied to the head they saw: the PR's head on GitHub, from `gh pr view <n> --json headRefOid` (REST: `.head.sha` from `gh api repos/{owner}/{repo}/pulls/<n>`), not a local commit the thread hasn't pushed.

```bash
node <issue-to-pr>/scripts/land.mjs hold <record> --head <the PR's head>
```

Then check the PR the way the thread's watch does: stage 6 in a build's thread, one pass of the pr-watch loop in an `/apr` thread. Once the PR is clean, which in a build's thread is stage 7 at `ready`, check the held land:

```bash
node <issue-to-pr>/scripts/land.mjs check <record>
```

- **Exit 0.** The PR has the patch "land" was said on, a restack after the predecessor merged included. Land it through `ship land <n>`.
- **Exit 1 after a push.** The push changed the patch, so the script dropped the land. Tell the user in one line, and the PR waits for "land" again.

`--merge` is "land" given at the build's start. Stage 1 holds it with `land.mjs hold <record> --merge`, and it lands whatever patch is clean. Only the user adds `--merge`, and a thread that starts a build passes it on only when the user gave it.

## Fixes after the build

From stage 6 on, the thread fixes failed checks, conflicts and bot findings on its own, through pr-watch, and posts one line in the thread per fix: the line `repairs.mjs add` prints. Replies to people wait for "post".

## Repair budget

A PR has 10 repairs for its whole life: the build, its watch and the fixes after, until it merges. `--max-repairs` sets another number at the build's start, and each "more" adds 10.

A repair is one commit that changes code to fix a review finding, a failed check, a bot finding, a red `/verify`, a review-ready violation or a verifier's FAIL, or one rebase that resolves a conflict. Fixes the user asks for, such as their comments in stage 8, and a human reviewer's clear requests don't count. A restack after the predecessor moved is a repair only when it resolved a conflict.

Record each fix right after its commit, counted or not, with `--asked` for one the user or a human reviewer asked for. On "more", add 10 to the budget:

```bash
node <issue-to-pr>/scripts/repairs.mjs add <record> --commit <sha> --fix "<what it fixed>" [--asked]
node <issue-to-pr>/scripts/repairs.mjs more <record>
```

`add` appends the fix to the record, keeps the header's `repairs: <used>/<budget>`, and prints the line to post. pr-watch gets the repairs left as `--max-repairs`. When `add` says the budget is spent, or refuses a fix because it already was, stop: record `blocked: repair budget`, call `unwatch_pull_request` so the thread moves to the user's inbox, and post what is still open. A refused fix stays unpushed until "more".

## Watching

The thread watches its PR with `watch_pull_request` only while the PR waits on someone else, such as a running check, a bot or a person. When it's the user's move, as at a clean PR, a held reply, a spent budget or a question, it calls `unwatch_pull_request`, and the thread sits in the user's inbox.

## On merge

Once GitHub reports the PR merged, whether `ship land` merged it or the thread finds it merged when it next runs, call `unwatch_pull_request`, record `merged`, and clean up. Run the script from the project's main checkout, the first entry in `git worktree list`, because it removes this thread's worktree:

```bash
cd <main checkout> && node <issue-to-pr>/scripts/after-merge.mjs <PR URL>
```

It removes the worktree that holds the PR's branch, the local branch and origin's branch, and GitHub retargets any PR stacked on that branch. In the main checkout it switches to the PR's base branch instead. It keeps whatever could lose work, and prints each with its reason, so name them to the user: a checkout with uncommitted changes, a worktree with ignored files Git doesn't keep, such as a `.env`, or a branch with commits the PR never had. Dependencies and build output, such as `node_modules`, go with the worktree. T3 then settles the thread.

## `try`

Run the PR for the user to test by hand. Find the launch recipe and prepare the app as `/pr-review`'s `try` does, but from this thread's checkout, and open it in T3's preview browser (`preview_open`) or, for a mobile app, the device panel (`device_open`). Stop what it started when they move on.
