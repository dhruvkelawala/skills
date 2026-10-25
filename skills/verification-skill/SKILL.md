---
name: verification-skill
description: Use when a repo has no repeatable way for an agent to launch and drive its app to prove a feature works (`create`), or when its `verify-<app>` skill needs checking against the source and the running app (`check`). Writes and maintains `.agents/skills/verify-<app>/`, with launch, doctor, drive and cleanup steps and a feature map. For repository checks use /verify; for PR proof and publishing use /evidence.
license: MIT (LICENSE)
---

# Verification skill

An agent that built a feature should be able to prove it works by running the app itself, without a human. This skill writes the project-local skill that makes that possible, and keeps it in step with the app.

Invoke as `/verification-skill create [app]` or `/verification-skill check [verify-<app>]`. A bare `/verification-skill` runs `check` when the repo has `.agents/skills/verify-*/` and `create` when it does not.

`EVIDENCE.md` owns the per-change proof checklist and where captures are published, and the verify skill links to it. `/verify` runs the repository's checks, not the live app.

## What a verify skill contains

`.agents/skills/verify-<app>/SKILL.md` has `name: verify-<app>`, a description that names the app, its surface and when to use it, and these sections, each built from commands that ran:

- **Launch.** Exact setup and launch commands from an empty data folder to a usable state, environment variable names (never secret values), the readiness signal, the build being run, and teardown. A server or UI runs as one instance this run owns. A CLI or TUI gets a fresh isolated session for each drive.
- **Doctor.** A read-only check that the instance is the one this run owns, on the expected build, port and profile, ready, and signed in when it needs to be. Run it before driving and after anything surprising. Relaunch a stuck UI even when its process looks healthy.
- **Drive.** Literal commands and selectors from the repo, the starting state, waits on observable conditions, and assertions. Match labels as rendered, and prefer stable handles to coordinates. Confirm the harness case actually ran, because a run with zero tests or all tests skipped proves nothing.
- **Evidence.** Capture the action and the resulting state through the real user path, plus a second view of any side effect, such as a written file or row. Record the revision, feature ID and entry point. Mock only at an existing production boundary and say so. When the safe path is a dry-run mode, observe what it skips (files, network, git) instead of trusting its name. Keep captures at an ignored or external path and link `EVIDENCE.md` for PR proof.
- **Cleanup.** Stop only the processes this run started, by their recorded handle, including after failed attempts. Captures survive every teardown, including the harness's own.

Ship a helper script only when the repo's harness cannot express a recipe. Make it executable, show its invocation in the skill, and give non-trivial logic a runnable check.

`features/README.md` is the index. It holds the baseline state, driving conventions, how to report proof and skips, a link to each feature file on disk, and a short `Not mapped yet` list of features no replay has driven, each with its reason. Each feature file has an H1, a short paragraph on what the user sees, and exactly these H2s in this order:

1. `Sub-features`: short stable IDs, one observable behaviour each.
2. `How to get to it (user POV)`: every entry point a user has.
3. `Driving it with <harness>`: preconditions, then pairs of exact action and observable result, ending with what proves the end state.
4. `Gotchas`: focus, timing, prerequisites, destructive effects and harness limits.

[The example map](references/feature-map-example/README.md) and its two feature files show the shape. Copy the shape, not the commands.

## Create

A skill written from a reading of the repo comes out generic, so create runs the app first, writes the skill from what worked, and has a fresh agent replay it.

1. **Run.** Learn how the app runs. Read the agent instructions, README, manifests, CI, `EVIDENCE.md` and any existing harness. Pick the driver by the tiers in evidence's [surface recipes](../evidence/references/surfaces.md#who-drives-the-surface). Plan isolation with separate ports, profiles, data folders and credentials, and keep user state outside the repo. Start a record outside the repo before the first command, and add each command to it as it runs, with what it printed. Then get one surface usable from a clean environment: a fresh shell, nothing left running from an earlier attempt, and every tool either from the repo or named as a prerequisite. Ready means usable: launch reaches a usable state from an empty data folder, including any migrations and seed data. A port that answers, or a health check that passes while init still runs, is not ready. Drive the top three to five features with the driver, taken from real commands, routes, menus or docs. When the app cannot start, report the exact blocker and stop.
   Complete when one surface is usable from an empty data folder, each of those features was driven or failed, and the record holds every command the run ran.
2. **Record.** Go through the record while the run is fresh. Mark each command that worked with the output that showed it worked, and each that failed with the error, why it failed and what fixed it. A journey the seed data can't satisfy fails, and its reason goes in that feature's Gotchas, or beside the feature under `Not mapped yet` when none of its journeys passed. Never weaken a journey to make it pass. When the run used a stand-in for the real target, such as a simulator for a device or a local stack for a hosted one, list every setup step the stand-in did that the target won't.
   Complete when every command in the record is marked as worked or failed, and every failure has its cause.
3. **Write.** Write Launch, Doctor, Drive, Evidence and Cleanup from the record alone. Put each failure a later run could hit beside the step it breaks, with its symptom, cause and fix. List the stand-in's extra setup steps as unverified until a run on the real target covers them. Give a feature a file only when the run drove it, and list the rest under `Not mapped yet` in the index, each with its reason. Check that the host finds skills in `.agents/skills/`. When it does not, document in the skill how to load it by absolute path, and leave user settings alone. Add one line to `EVIDENCE.md` linking the skill, or suggest `/evidence` when the repo has no `EVIDENCE.md`.
   Complete when every command in the skill appears in the record, and the index matches the feature files on disk.
4. **Replay.** Run the skill's Cleanup so nothing of yours is running. Then start a fresh subagent with only the new skill and none of this conversation, or a fresh headless session when the host has no subagents. Give it the skill's path, and ask it to follow Launch, Doctor, one drive for each mapped feature with its capture, and Cleanup, exactly as written and changing nothing. It runs Cleanup even after a failure. It reports each result, every question it had to answer for itself and every step it improvised. Each question and improvised step is a gap. Fix the skill from a command that ran, add that command to the record, and replay with a new subagent until a replay needs nothing. A feature a replay can't drive gets a fix and another replay, or moves to `Not mapped yet` with its reason. When this skill caused a gap, fix this skill too. After the last replay, confirm its captures still exist and are not empty.
   Complete when a fresh subagent's replay drove every mapped feature with no question and nothing improvised, no process this run or a replay started is left, and the replay's captures survived cleanup.

## Check

Edit only the verify skill's folder. Report broken app behaviour and leave product code alone.

1. Pick the target, usually the only `.agents/skills/verify-*/`. With several, ask which one. With none, run `create`. Fix missing, duplicate or dead links in the index.
   Complete when the index lists exactly the feature files on disk.
2. Read each feature from source. Hand each feature to a native subagent on the thread's model. With no subagent available, read them yourself and say so. Each feature needs a summary, its source entry points, likely drift with citations or "none", and one live recipe. Spot-check the drift citations, and scan recent source changes for user-facing features the map lacks. Name a source path before calling a feature missing.
   Complete when every feature has a source summary and a live recipe.
3. Drive every feature live, yourself and one at a time, even when the source looks clean. Follow the verify skill's launch model, and run doctor before the first drive, on each fresh session and after any failure. A feature counts as unreachable only with the route you tried and the missing prerequisite, such as auth or an OS version. Add that prerequisite to the map. Re-drive every harness fix before counting it.
   Complete when every feature has a live result or a named blocker, no process this run started is left, and earlier captures still exist.
4. Sort what you found. Fix the map where a description is wrong or missing. Fix the skill or its helper where working behaviour cannot be driven, then re-drive. Report broken app behaviour with its steps and the expected and actual result. Re-read every changed file and run `/verify` on any helper.
   Complete when every finding is fixed and re-proved, or reported.

Report one outcome, with per-feature coverage, the entry points driven, capture paths and the revision:

- `clean` when every feature has source and live coverage and nothing changed.
- `changed` with the proven corrections as one local diff, or as one PR through `/apr` when the user asked to ship.
- `blocked` with the feature, the route tried and what is missing.

Changes to this skill are measured with [its eval](evals/README.md).

Adapted from pstack's create-verification-skill and maintain-verification-skill by Lauren Tan (MIT), cursor/plugins@e5a8186, and its readiness rules from cursor/plugins@c49b37a2c0.
