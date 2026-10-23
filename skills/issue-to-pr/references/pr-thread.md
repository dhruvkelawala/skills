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

When the user says "land", hold it first, tied to the head they saw:

```bash
node <issue-to-pr>/scripts/land.mjs hold <record>
```

Then check the PR the way the thread's watch does: stage 6 in a build's thread, one pass of the pr-watch loop in an `/apr` thread. Once the PR is clean, which in a build's thread is stage 7 at `ready`, check the held land:

```bash
node <issue-to-pr>/scripts/land.mjs check <record>
```

- **Exit 0.** The PR has the patch "land" was said on, a restack after the predecessor merged included. Land it through `ship land <n>`.
- **Exit 1 after a push.** The push changed the patch, so the script dropped the land. Tell the user in one line, and the PR waits for "land" again.

`--merge` is "land" given at the build's start. Stage 1 holds it with `land.mjs hold <record> --merge`, and it lands whatever patch is clean. Only the user adds `--merge`, and a thread that starts a build passes it on only when the user gave it.

## `try`

Run the PR for the user to test by hand. Find the launch recipe and prepare the app as `/pr-review`'s `try` does, but from this thread's checkout, and open it in T3's preview browser (`preview_open`) or, for a mobile app, the device panel (`device_open`). Stop what it started when they move on.
