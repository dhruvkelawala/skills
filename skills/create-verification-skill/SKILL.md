---
name: create-verification-skill
description: Generate a project-local skill that launches, health-checks, and drives the real app with a maintained feature map. Use for /create-verification-skill, requests for an app-driving skill, or when a repository lacks a repeatable way to prove user-facing behaviour. For PR capture checklists and publishing, use /evidence instead.
license: MIT (LICENSE)
---

# Create a verification skill

Invoke as `/create-verification-skill [app]`. In plain Pi, use `/skill:create-verification-skill`.

Write `.agents/skills/verify-<app>/` for an agent arriving cold. The generated skill owns launch, doctor, drive, cleanup, and the feature map. `EVIDENCE.md` owns the per-change PR-proof checklist and publish path; link to it rather than inventing another publishing workflow. `/verify` still runs repository checks, not live app driving.

## 1. Interview the repo

Read agent instructions, README, manifests, CI, development docs, `EVIDENCE.md`, and existing harnesses. Answer from source; ask only for unobservable product or permission decisions:

- **Surface and run.** Primary user surface, other surfaces, exact local launch command, prerequisites, readiness signal, ports, auth, fixtures, and build identity.
- **Drive and observe.** Existing harness, real user inputs or stable selectors, capture format, and observable side effects. Follow the tiers in [evidence's surface recipes](../evidence/references/surfaces.md): repo harness first, then available computer-use/browser tooling, then terminal/manual capture. For web driving prefer the host's native `agent_browser` when available; otherwise agent-browser or installed terminal tooling. Name a working fallback when a tool is unavailable.
- **Isolate and own.** Separate ports, profiles, data directories, credentials, and process handles. Refuse to drive a shared user instance when isolation is unavailable. Keep user state outside the repo.

Run the documented setup and launch before drafting. If the base cannot start, report the exact blocker instead of teaching guessed steps. Fix only within authorized scope. Temporary scaffolding for irrelevant missing assets is allowed only when identified as such, with its cleanup and any repository restrictions recorded.

**Complete when:** one local surface starts, its build and readiness are identified, and the driving/capture/isolation choices are grounded in actual commands.

## 2. Generate the skill

Write `.agents/skills/verify-<app>/SKILL.md`. Use matching lowercase-hyphen `name` and a `description` naming the app, surface, and triggers. Follow `/writing-for-agents`. Leave no placeholders. Include:

- **Launch.** Exact setup and launch commands, environment variable names (never values of secrets), readiness condition, build provenance, and teardown. Servers/UIs may use one owned long-lived instance; short-lived CLI/TUI drives use fresh isolated sessions. Describe which model applies.
- **Doctor.** A read-only health check for the actual instance: owned process/session, expected build/profile/port, readiness, auth when required. A launcher dependency check alone is not instance health. Run before driving and after surprises; reset or relaunch a wedged UI even if the process is healthy.
- **Drive.** Literal commands/selectors from the repo, baseline state, waits for observable conditions, and assertions. Match rendered labels, not handler strings (case/format may change during rendering). Prefer stable handles over coordinates or tab order. Require the selected harness case actually ran; an all-skipped or zero-test exit is not proof. Distinguish real runtime drives from fixture-only coverage.
- **Evidence.** Capture the action and resulting state through the real user path, plus a second view of side effects (files, rows, messages) for mutations. Record revision, feature ID, entry point, command, and result. Use mocks only at an existing external production boundary and disclose them. Observe what dry-run/test mode actually skips, including network/browser/git effects; its name is not a safety guarantee. Keep proof outside disposable scratch state, at an ignored or external path. Link `EVIDENCE.md` for PR standards and publishing; respect any no-publish restriction.
- **Cleanup.** Stop only processes this run owns, by recorded handle/identity, including failed iterations. Obey repository deletion restrictions; retaining scratch state is preferable to unauthorized removal. Evidence survives every teardown and retry, verified by file existence and size.

Ship helpers only when the existing harness cannot express the recipe. Make them executable, document their invocation, and include a runnable check for non-trivial logic. Inspect existing harness teardown too: it may delete success captures or scratch state automatically.

Validate the generated skill with the installed Pi loader and check actual project discovery, not just frontmatter. If that Pi version does not scan `.agents/skills/`, keep the canonical location and document an explicit `--skill <absolute skill directory>` launch (or direct file-read fallback on other hosts); do not write user settings to make discovery pass.

If `EVIDENCE.md` exists, add one line linking the generated skill for launch/doctor/drive. If absent, suggest `/evidence` to establish the PR checklist and publish path; generation does not publish artifacts.

**Complete when:** another agent can run the skill without reconstructing missing commands, lifecycle rules, or proof expectations.

## 3. Seed the feature map

Write `features/README.md` and one file per identified user-facing feature, starting with the top 3–5 from actual commands, routes, menus, or docs. Read [the example index](references/feature-map-example/README.md) and its linked feature files for the contract, not commands to copy.

The index owns baseline preconditions, driving conventions, proof/skip reporting, and links to exactly the feature files on disk. Each feature has an H1, a user-visible summary, and exactly these four H2s, in order:

1. `Sub-features`: short stable IDs and observable behaviours.
2. `How to get to it (user POV)`: every known user entry point.
3. `Driving it with <harness>`: preconditions, exact action/command/result pairs, and what evidence proves the end state.
4. `Gotchas`: focus, timing, prerequisites, destructive effects, harness limits.

Keep implementation details in source citations outside the user recipe. Mark mapped-but-unproven paths explicitly. One convenient entry point does not verify the others. This is a runnable verification map, not `/product-description`'s exhaustive behavioural specification.

**Complete when:** the index matches disk, every feature has the four sections, and every recipe names an observable proof or a concrete coverage gap.

## 4. Prove the generated skill

Follow its instructions end to end: launch, doctor, drive **one mapped feature**, capture the action and outcome, clean up, then confirm nonempty evidence still exists at the named path. A test pass or fixture alone is not proof of a real user path.

On failure, capture the failure and clean up that iteration before retrying. Fix the generated skill/harness within scope, then rerun the failed path. If the generator caused the gap, repair this skill too. An unexecuted or blocked skill is a draft, not a deliverable.

**Complete when:** the real drive passed, no owned process remains, and evidence survived cleanup. Report commands, feature/entry point, revision, artifact path, failures/repairs, and unproven coverage.

## 5. Hand off maintenance

Point to `/maintain-verification-skill` for source and live coverage of the whole map. Suggest a cadence only on request. Report tradeoffs and tools still required. Commit or publish only when authorized.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
