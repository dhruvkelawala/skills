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

- **Launch.** Exact setup and launch commands, environment variable names (never secret values), the readiness signal, the build being run, and teardown. A server or UI runs as one instance this run owns. A CLI or TUI gets a fresh isolated session for each drive.
- **Doctor.** A read-only check that the instance is the one this run owns, on the expected build, port and profile, ready, and signed in when it needs to be. Run it before driving and after anything surprising. Relaunch a stuck UI even when its process looks healthy.
- **Drive.** Literal commands and selectors from the repo, the starting state, waits on observable conditions, and assertions. Match labels as rendered, and prefer stable handles to coordinates. Confirm the harness case actually ran, because a run with zero tests or all tests skipped proves nothing.
- **Evidence.** Capture the action and the resulting state through the real user path, plus a second view of any side effect, such as a written file or row. Record the revision, feature ID and entry point. Mock only at an existing production boundary and say so. When the safe path is a dry-run mode, observe what it skips (files, network, git) instead of trusting its name. Keep captures at an ignored or external path and link `EVIDENCE.md` for PR proof.
- **Cleanup.** Stop only the processes this run started, by their recorded handle, including after failed attempts. Captures survive every teardown, including the harness's own.

Ship a helper script only when the repo's harness cannot express a recipe. Make it executable, show its invocation in the skill, and give non-trivial logic a runnable check.

`features/README.md` is the index. It holds the baseline state, driving conventions, how to report proof and skips, and a link to each feature file on disk. Each feature file has an H1, a short paragraph on what the user sees, and exactly these H2s in this order:

1. `Sub-features`: short stable IDs, one observable behaviour each.
2. `How to get to it (user POV)`: every entry point a user has.
3. `Driving it with <harness>`: preconditions, then pairs of exact action and observable result, ending with what proves the end state.
4. `Gotchas`: focus, timing, prerequisites, destructive effects and harness limits.

[The example map](references/feature-map-example/README.md) and its two feature files show the shape. Copy the shape, not the commands.

## Create

1. Learn how the app runs. Read the agent instructions, README, manifests, CI, `EVIDENCE.md` and any existing harness. Pick the driver by the tiers in evidence's [surface recipes](../evidence/references/surfaces.md#who-drives-the-surface). Plan isolation with separate ports, profiles, data folders and credentials, and keep user state outside the repo. Run setup and launch. When the app cannot start, report the exact blocker and stop.
   Complete when one surface has started, and its readiness signal, driver, capture method and isolation each rest on a command that ran.
2. Write the skill. Seed the feature map with the top three to five features, taken from real commands, routes, menus or docs, and mark paths that are mapped but unproven. Check that the host finds skills in `.agents/skills/`. When it does not, document in the skill how to load it by absolute path, and leave user settings alone. Add one line to `EVIDENCE.md` linking the skill, or suggest `/evidence` when the repo has no `EVIDENCE.md`.
   Complete when another agent could run the skill without a missing command, and the index matches the feature files on disk.
3. Prove it. Follow the new skill end to end: launch, doctor, drive one mapped feature, capture, clean up, then confirm the capture still exists and is not empty. On a failure, capture it, clean up, fix the skill and rerun. When this skill caused the gap, fix this skill too.
   Complete when the drive passed, no process this run started is left, and the capture survived cleanup.

## Check

Edit only the verify skill's folder. Report broken app behaviour and leave product code alone.

1. Pick the target, usually the only `.agents/skills/verify-*/`. With several, ask which one. With none, run `create`. Fix missing, duplicate or dead links in the index.
   Complete when the index lists exactly the feature files on disk.
2. Read each feature from source. Hand each feature to a helper agent with the `research` role: on Pi or SumoCode spawn role `research`; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. With no helper available, read them yourself and say so. Each feature needs a summary, its source entry points, likely drift with citations or "none", and one live recipe. Spot-check the drift citations, and scan recent source changes for user-facing features the map lacks. Name a source path before calling a feature missing.
   Complete when every feature has a source summary and a live recipe.
3. Drive every feature live, yourself and one at a time, even when the source looks clean. Follow the verify skill's launch model, and run doctor before the first drive, on each fresh session and after any failure. A feature counts as unreachable only with the route you tried and the missing prerequisite, such as auth or an OS version. Add that prerequisite to the map. Re-drive every harness fix before counting it.
   Complete when every feature has a live result or a named blocker, no process this run started is left, and earlier captures still exist.
4. Sort what you found. Fix the map where a description is wrong or missing. Fix the skill or its helper where working behaviour cannot be driven, then re-drive. Report broken app behaviour with its steps and the expected and actual result. Re-read every changed file and run `/verify` on any helper.
   Complete when every finding is fixed and re-proved, or reported.

Report one outcome, with per-feature coverage, the entry points driven, capture paths and the revision:

- `clean` when every feature has source and live coverage and nothing changed.
- `changed` with the proven corrections as one local diff, or as one PR through `/apr` when the user asked to ship.
- `blocked` with the feature, the route tried and what is missing.

Adapted from pstack's create-verification-skill and maintain-verification-skill by Lauren Tan (MIT), cursor/plugins@e5a8186.
