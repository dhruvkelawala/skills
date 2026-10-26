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
- **Drive.** Literal commands and selectors from the repo, the starting state, waits on observable conditions, and assertions. Match labels as rendered, and prefer stable handles to coordinates. Judge each result by [What counts as a pass](#what-counts-as-a-pass).
- **Evidence.** Capture the action and the resulting state through the real user path, plus a second view of any side effect, such as a written file or row. Record the revision, feature ID and entry point. Mock only at an existing production boundary and say so. When the safe path is a dry-run mode, observe what it skips (files, network, git) instead of trusting its name. Keep captures at an ignored or external path and link `EVIDENCE.md` for PR proof.
- **Cleanup.** Stop only the processes this run started, by their recorded handle, including after failed attempts. Captures survive every teardown, including the harness's own.

Ship a helper script only when the repo's harness cannot express a recipe. Make it executable, show its invocation in the skill, and give non-trivial logic a runnable check.

`features/README.md` is the index. It holds the baseline state, driving conventions, a `What counts as a pass` section, how to report proof and skips, a link to each feature file on disk, and a short `Not mapped yet` list of features no replay has driven, each with its reason. Each feature file has an H1, a short paragraph on what the user sees, and exactly these H2s in this order:

1. `Sub-features`: short stable IDs, one observable behaviour each.
2. `How to get to it (user POV)`: every entry point a user has.
3. `Driving it with <harness>`: preconditions, then pairs of exact action and observable result, ending with what proves the end state and how that proof was seen failing.
4. `Gotchas`: focus, timing, prerequisites, destructive effects and harness limits.

[The example map](references/feature-map-example/README.md) and its two feature files show the shape. Copy the shape, not the commands.

## What counts as a pass

A check that has never been seen failing proves nothing. Create sees doctor and each final assertion fail once and records how. A later run sees a check fail again only when it changes that check. The index's `What counts as a pass` section states these rules in the app's own terms, with how doctor was seen failing, and every run judges its results by them, create's included:

- Doctor fails against a stopped instance and against a stale one, such as an instance still on an earlier build or started with another data folder.
- Each drive's final assertion has run once where its effect is absent, such as on the base revision, with the feature off or before the state is reached, and failed. The feature file records how, or why no run can make the effect absent.
- Zero tests, any skipped test or any retry is not a pass. A drive that has flaked once runs twice in a row with retries off, and passes both times.
- A measurement shows that something was measured, such as a non-zero sample count.
- Each feature has at least one unmocked recipe. A mocked recipe is labelled UI-only and lists its mocks.
- Open each capture before keeping it, and check that it shows the requested state.

## Create

A skill written from a reading of the repo comes out generic, so create runs the app first, writes the skill from what worked, and has a fresh agent replay it.

1. **Run.** Learn how the app runs. Read the agent instructions, README, manifests, CI, `EVIDENCE.md` and any existing harness. Pick the driver by the tiers in evidence's [surface recipes](../evidence/references/surfaces.md#who-drives-the-surface). Plan isolation with separate ports, profiles, data folders and credentials, and keep user state outside the repo. Before the first command, start the record at a path outside the repo, and run every command through the recorder, assertions included: `node <this skill's folder>/scripts/record.mjs <record> '<command>'`. It prints what the command printed, exits with its status, and appends the command, its exit status, its output, how long it took and the load average to the record. Then get one surface usable from a clean environment: a fresh shell, nothing left running from an earlier attempt, and every tool either from the repo or named as a prerequisite. Ready means usable: launch reaches a usable state from an empty data folder, including any migrations and seed data. A port that answers, or a health check that passes while init still runs, is not ready. Drive and capture the top three to five features with the driver, taken from real commands, routes, menus or docs. Then see each check fail once, as [What counts as a pass](#what-counts-as-a-pass) says: stop the instance and run doctor, run doctor again against a stale instance, and run each driven feature's final assertion where its effect is absent. Tighten a check that passes there until it fails there and still passes where the effect is present. When no run can make a feature's effect absent, record why. When the app cannot start, report the exact blocker and stop.
   Complete when one surface is usable from an empty data folder, each of those features was driven or failed, the record shows doctor failing against a stopped and a stale instance and each driven feature's final assertion failing where its effect is absent or why it can't be, and the record holds every command the run ran.
2. **Record.** Go through the record before writing anything. Mark each command that worked with the output that showed it worked, and each that failed with the error, why it failed and what fixed it. A command run to see a check fail worked only when the check failed, so mark it with that failure. A journey the seed data can't satisfy fails, and its reason goes in that feature's Gotchas, or beside the feature under `Not mapped yet` when none of its journeys passed. Never weaken a journey to make it pass. When the run used a stand-in for the real target, such as a simulator for a device or a local stack for a hosted one, add to the record every setup step the stand-in did that the target won't.
   Complete when every command in the record is marked as worked or failed, and every failure has its cause.
3. **Write.** Write Launch, Doctor, Drive, Evidence and Cleanup from the record alone. Write the index's `What counts as a pass` from it too, with how doctor was seen failing, and end each feature's proof with how it was seen failing or why it can't be. Put each failure a later run could hit beside the step it breaks, with its symptom, cause and fix. List the stand-in's extra setup steps as unverified until a run on the real target covers them. Give a feature a file only when the run drove it, and list the rest under `Not mapped yet` in the index, each with its reason. Check that each agent host the repo has instructions for, such as Claude Code for `CLAUDE.md` and Codex for `AGENTS.md`, finds the skill: Claude Code reads `.claude/skills/`, and Codex reads `.agents/skills/`. Where a host doesn't, add the link it reads, such as a relative symlink from `.claude/skills/verify-<app>` to `../../.agents/skills/verify-<app>`, so every host loads the skill by name, and leave user settings alone. Add one line to `EVIDENCE.md` linking the skill, or suggest `/evidence` when the repo has no `EVIDENCE.md`.
   Complete when every command in the skill appears in the record, the index matches the feature files on disk, each feature's proof says how it was seen failing or why it can't be, and each of the repo's agent hosts finds the skill.
4. **Replay.** Run the skill's Cleanup so nothing of yours is running. Then start a fresh subagent with only the new skill and none of this conversation, or a fresh headless session when the host has no subagents. Give it the skill's path. Ask it to follow Launch, Doctor, one drive for each mapped feature with its capture, and Cleanup, exactly as written and changing nothing, and to run Cleanup even after a failure. Ask it to report each result, judged by the index's `What counts as a pass`, and every question it had to answer for itself and every step it improvised, each with what it chose and why. Run it in the foreground and wait for its report, because a replay left in the background can stop with nobody watching. Run replays one after another, never two at once, even for two skills in one repo, because one replay's load stretches the other's timings into false gaps. Before and after each replay, run `uptime` through the recorder, so the record holds the load average the replay ran under. A timeout learned under load, with the load average above the core count, goes into the skill only with its idle timing beside it.
   Then sort the report. A gap is a step that failed as written, or a question or improvised step where another reasonable choice could have failed a step or let it pass without proving what it claims, such as a command that errors, a wrong value or a wait the replay saw a step needed. A precaution the replay added is a gap too when the step without it could change the user's data, cross into another run, or touch something the skill says to leave alone, such as checking for another open run before stopping one. Everything else is a nit, where any reasonable choice ends the same, such as a capture's file name, a command any agent would write the same way, two places that disagree about a check that passes either way, or any other precaution, such as a sleep or a read. Fix each nit in the skill, and run any command a fix adds and add it to the record. Only a gap earns another replay: run each fix yourself, add its commands to the record, fix the skill, then replay with a new subagent. A feature a replay can't drive gets a fix and another replay, or moves to `Not mapped yet` with its reason. When this skill caused a gap, fix this skill too. When a gap in one skill applies to another skill in the same repo, such as a single run pointer that lets two runs stop each other's process, fix both, and count it as the sibling's own gap: a sibling that had stopped replays again, within its own three replays.
   Stop after the first replay with no gap, or after the third replay you start, because a replay that builds the app can take twenty minutes or more. Fix the third replay's gaps the same way and stop there: move a feature it couldn't drive to `Not mapped yet`, and name each fix no replay ran in your reply. After the last replay, confirm its captures still exist and are not empty. When the base moves after the last replay, such as main gaining a commit that changes a pinned version, run Launch, Doctor, each drive and Cleanup again on the new base. When any of them has to change, replay once more within the three replays, or name each fix no replay ran in your reply and under Not checked in the PR that ships the skill.
   Complete when the last replay drove every mapped feature, it had no gap or was the third replay with each gap fixed and named in your reply, the skill's steps ran on the base it ships on, no process this run or a replay started is left, and the last replay's captures survived cleanup.

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
