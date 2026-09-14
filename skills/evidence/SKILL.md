---
name: evidence
description: Write or refresh a repository's EVIDENCE.md, the document that tells an agent how to run this project's features and capture proof they work (screenshots, recordings, terminal transcripts, request/response captures) and where that proof is published. Use when the user invokes /evidence, asks how to prove a feature works in this repo, or when /issue-to-pr finds no EVIDENCE.md.
---

# Evidence

A passing test is a claim the code makes about itself. Evidence is the feature seen working: a screenshot of the screen the user gets, a recording of the flow, the exact terminal transcript, the request and the response. This skill writes the one document that tells any agent how to produce that for *this* repository, so every PR can carry it.

Invoke as `/evidence` to write or refresh `EVIDENCE.md`, or `/evidence plan <feature>` to produce a one-off capture plan from an existing `EVIDENCE.md` without editing it.

## 1. Learn how the project runs

Read before writing: `README`, `AGENTS.md` or `CLAUDE.md`, `CONTEXT.md`, the package manifest or build file, CI workflows, and any existing `docs/` on running or demoing the app. Then answer, from the code and configs, not from guesses:

1. **Surfaces.** Which of these the project has: web UI, mobile app, desktop app, terminal UI, CLI, HTTP or RPC API, library, background worker, browser extension. A monorepo can have several; list each with its path.
2. **Launch.** The exact commands that bring each surface up locally for a demo, with required env, seed data, ports, simulators, or fixtures. If a command needs a secret, say which variable, never its value.
3. **Drive.** How a feature is exercised on each surface: a URL and clicks, a screen and taps, a command and flags, a request. Name the tools already in the repo: Playwright config, Maestro flows, Storybook, fixtures, a demo script, `xcodebuild` schemes.
4. **Capture.** Which capture method fits each surface. Pick from [the surface recipes](references/surfaces.md) and adapt to what is installed; prefer tools the repo already depends on.
5. **Publish.** Where captures live so a PR can link them. Default is the `evidence` orphan branch via `scripts/publish-evidence.sh`, which keeps binaries off the main history and yields links that render for anyone who can see the repo. A repo that already keeps evidence somewhere (a `docs/evidence/` convention, an artifacts bucket) keeps its convention.
6. **Exemptions.** Surfaces where behaviour capture genuinely does not apply, such as a pure library with no runnable example. Exempt narrowly and say why; a library with a CLI or example script is not exempt.

Run the launch command for at least one surface to confirm it starts. An `EVIDENCE.md` whose commands were never run is a guess.

**Complete when:** every surface has a launch command that was executed once, a drive method, a capture recipe with the exact command, and a publish path.

## 2. Write EVIDENCE.md

At the repo root unless `AGENTS.md` names another home. Shape:

```md
# Evidence

How to prove a change works in this repository. Agents read this before writing a PR body; a PR claim without a capture from this document is not evidence.

## Surfaces

| Surface | Path | Launch | Drive | Capture |
| --- | --- | --- | --- | --- |
| <web app> | apps/web | `pnpm dev` → http://localhost:3000 | Playwright (`e2e/`) or browser | Playwright screenshot + video |
| ... | | | | |

## Launch

### <surface>
<exact commands, env vars by name, seed/fixture steps, how to know it is up>

## Capture recipes

### <surface>
<exact capture commands from the recipes reference, adapted; where files land; how to trim>

## Publish

<the storage decision and the command; link format for PR bodies>

## Exemptions

<surface: reason>, or `none`

## Per-change checklist

1. Launch the surface the change touches.
2. Drive the exact behaviour each acceptance criterion names, before and after when the change alters existing behaviour.
3. Capture: still for a state, recording for a flow, transcript for a CLI or API, side by side for before/after.
4. Publish and link from the PR's Evidence section with the HEAD SHA the capture came from.
```

Keep it under 150 lines. Commands are copy-pasteable. No narrative about the architecture; that lives elsewhere.

**Complete when:** `EVIDENCE.md` exists, every surface from step 1 appears in the table, and each capture recipe names a file that would be produced.

## 3. Prove it

Pick one small existing feature and run the checklist end to end: launch, drive, capture, publish. Put the resulting link in the report. If any step fails, fix the document, not the report.

## Report

- `EVIDENCE.md` path and the surfaces it covers
- The sample capture's link and the command that produced it
- Exemptions and why
- Tools the document assumes that are not installed, if any

## Plan mode (`/evidence plan <feature>`)

Read `EVIDENCE.md`, name the surface the feature lives on, and return the launch, drive, and capture commands for that feature plus the file names the captures will have. Do not edit the document. If `EVIDENCE.md` is missing, say so and offer to write it.
