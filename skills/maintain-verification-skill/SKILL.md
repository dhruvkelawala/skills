---
name: maintain-verification-skill
description: Keep a project's app-driving verification skill and feature map aligned with source and live behaviour. Use for /maintain-verification-skill or an audit of a verify skill. For repository test commands use /verify; for PR proof and publishing use /evidence.
license: MIT (LICENSE)
---

# Maintain a verification skill

Invoke as `/maintain-verification-skill [verify-<app>]`. In plain Pi, use `/skill:maintain-verification-skill`.

Cover every feature file from source and exercise every feature live. The unit of coverage is the feature, not every sentence. Keep concise run notes in ignored or external scratch storage, never committed user state.

## Scope and outcomes

Edit only the target skill directory: `SKILL.md`, `features/`, and helpers it owns. Product regressions are reported, not repaired or disguised as doc changes. `EVIDENCE.md` continues to own PR capture standards and the publish path.

Report one outcome:

- **clean**: every feature has source and live coverage; nothing worth changing. No new branch or PR.
- **changed**: corrections are proven; report the diff and coverage. Ship at most one commit/PR of corrections, only with authorization.
- **blocked**: coverage or a safe correction could not finish. Name the feature, attempted route, prerequisite, and remaining work. No PR claiming completion.

## 1. Locate and reconcile the index

Find the project-local skill with launch/doctor/drive instructions and a feature map, usually `.agents/skills/verify-*/`. Multiple candidates: ask which; none: point to `/create-verification-skill` and stop.

Read the skill and feature index, compare links with sibling files, and correct missing, duplicate, or dead entries within scope. Obey repository restrictions on removals. Keep an explicit list of feature files for coverage; no generated inventory framework.

**Complete when:** one target is selected and the index accounts for every feature file.

## 2. Read source per feature

When `subagent_spawn` is available, launch one `role: research` child per feature concurrently. Research is cheap, read-only investigation. Pass the target skill, feature file, repository path/revision, and this bounded assignment:

> Explain this user-facing feature from source. Cite concrete entry points. Flag likely map drift, or say none. Return feature summary / source entry points / likely drift / one concise live-verification recipe. Read only; do not edit or drive the app.

Results arrive automatically; do not poll. Optional model overrides use `provider/modelId`, not Cursor model aliases. Use `review` for a bounded technical review or `advisor` for a strong second opinion when needed; source reading needs neither. Coding delegates, if needed, use `implement-cheap` or `implement-smart` in a worktree restricted to the target skill, and the coordinator re-drives their fixes. Without subagents, read each feature sequentially and produce the same return shape yourself.

Reconcile only after every feature has a summary. Spot-check drift citations, merge overlapping recipes into as few baseline states as practical, and sweep recent source churn for omitted user surfaces. Require a concrete source path before calling a feature missing.

**Complete when:** every feature has source coverage and a live recipe, and suspected drift has a checked citation.

## 3. Drive the whole map

The coordinator owns all live driving, serially, even when source looks clean. Follow the target skill's launch model: one owned instance for a long-lived UI/server, a fresh isolated session per short-lived drive. Use the repo harness or the tiers in [evidence's surface recipes](../evidence/references/surfaces.md); for web use native `agent_browser` when available, otherwise agent-browser or installed terminal tooling.

Maintain these invariants through failures and retries:

- **Healthy instance.** Doctor before the first drive, on every fresh session, and after a failed or surprising drive. A wedged UI on a healthy process needs reset/relaunch. If doctor fails because the skill drifted, fix within scope, restart only what the fix invalidated, and retry once before marking blocked.
- **Durable proof.** Capture action, result, revision, feature ID, and entry point under the target's evidence path. Verify earlier artifacts remain nonempty after every cleanup, including failed attempts. Follow `EVIDENCE.md` for PR proof; publishing is a separate authorized step.
- **Owned lifecycle.** Clean failed-iteration residue promptly. Stop only run-owned processes by identity, never process name. For an authorized shared instance, clean only run-created residue. Obey deletion restrictions and keep user state outside the repo. Final teardown follows all drives and re-proofs, even when the pass is blocked.

Exercise every feature at least once; report which entry points were actually driven. `verified-unreachable` requires an attempted route and a concrete missing prerequisite (auth, entitlement, OS, external state); it is not a successful live drive. Add omitted prerequisites to the map. Partial/unreachable coverage keeps the overall result blocked rather than clean. A harness correction must be re-driven live before it counts as proven.

**Complete when:** every feature has a live result or explicit blocker, all re-proofs are recorded, no run-owned process remains, and evidence survived teardown.

## 4. Triage and hand off

Wrong/missing user description is **doc drift**: correct the map. Working behaviour the harness cannot drive is a **harness gap**: correct the skill or its helper, keep scripts executable with documented invocations, and re-drive. Broken app behaviour is a **product gap**: report the reproduction and observed/expected result; keep it out of the corrections.

Re-read every changed file, check index links and four-H2 contracts, run relevant helper/repository checks with `/verify`, and re-prove changed recipes. Do not claim clean coverage from source alone. If changes affect instructions mid-pass, invalidate the affected live results and rerun them.

Report outcome, source/live coverage per feature, attempted entry points and unreachable prerequisites, confirmed drift, corrections, evidence paths/revision, cleanup audit, verification results, and tradeoffs. Leave branches and worktrees intact. With shipping authorization, use `/apr` for at most one PR of proven corrections; otherwise leave the reviewed local diff or authorized commit and say it was not published.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
