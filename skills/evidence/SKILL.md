---
name: evidence
description: Use when the user invokes /evidence, asks how to prove a feature works in this repo, or when /issue-to-pr finds no EVIDENCE.md. Writes or refreshes EVIDENCE.md, which tells an agent how to run each part of the project, capture proof that a feature works (screenshots, recordings, terminal transcripts, request and response captures), and publish that proof for PRs.
---

# Evidence

Evidence is the feature seen working: a screenshot of the screen the user gets, a recording of the flow, the exact terminal transcript, or the request and its response. A passing test is not evidence. This skill writes `EVIDENCE.md`, the one document that tells any agent how to produce evidence in this repository, so every PR can carry it.

A surface is a place where a user meets the project, such as a web UI, a CLI, an API or a chat bot. Each surface has its own way to launch, drive and capture.

Invoke as `/evidence` to write or refresh `EVIDENCE.md`, or as `/evidence plan <feature>` to get a one-off capture plan from an existing `EVIDENCE.md` without editing it.

## 1. Learn how the project runs

Read the `README`, `AGENTS.md` or `CLAUDE.md`, `CONTEXT.md`, the package manifest or build file, CI workflows, and any `docs/` on running or demoing the app. When `.agents/skills/verify-*/SKILL.md` exists, link it from `EVIDENCE.md` for launching and driving, and reuse its feature map instead of copying its recipes. `EVIDENCE.md` still owns the PR proof checklist, the capture standards and the publish path. When no verify skill exists, suggest `/verification-skill create`.

Then answer these from the code and configs:

1. **Surfaces.** Which ones the project has: web UI, mobile app, desktop app, terminal UI, CLI, HTTP or RPC API, library, background worker, browser extension, chat bot or messaging integration, agent or LLM behaviour with evals, observability. A monorepo can have several, so list each with its path.
2. **Launch.** The exact commands that start each surface locally for a demo, with the env, seed data, ports, simulators or fixtures they need. Name a secret's variable, never its value.
3. **Drive.** How a feature is exercised on each surface and who drives it, by the tiers in [the surface recipes](references/surfaces.md#who-drives-the-surface): the repo's own harness first, computer-use when the host has it and no harness covers the surface, and a manual capture command as the fallback. Record the tier for each surface.
4. **Capture.** The capture method for each surface, taken from [the surface recipes](references/surfaces.md) and adapted to what is installed. Prefer tools the repo already depends on.
5. **Publish.** Where captures live so a PR can link them. The default is the `evidence` orphan branch, through `scripts/publish-evidence.sh`, which keeps binaries out of the main history and gives links that render for anyone who can see the repo. A repo that already keeps evidence elsewhere, such as `docs/evidence/` or an artifacts bucket, keeps its convention.
6. **Exemptions.** Surfaces where capture does not apply, such as a pure library with no runnable example, each with its reason. A library with a CLI or an example script is not exempt.

Run the launch command for at least one surface to confirm it starts.

Complete when every surface has a launch command that ran once, a drive method, a capture recipe with the exact command, and a publish path.

## 2. Write EVIDENCE.md

Put it at the repo root unless `AGENTS.md` names another place. Use this shape:

```md
# Evidence

How to prove a change works in this repository. Agents read this before writing a PR body. A claim in a PR needs a capture made with this document.

## Surfaces

| Surface | Path | Launch | Drive (tier) | Capture |
| --- | --- | --- | --- | --- |
| <web app> | apps/web | `pnpm dev`, ready at http://localhost:3000 | harness: Playwright (`e2e/`) | Playwright screenshot and video |
| <desktop app> | . | `make run` | computer-use, else manual | `screencapture -l <window>` |
| <slack bot> | src | `pnpm run mario` against test channel `#<name>` | manual: post the trigger message | thread JSON from the API and a client screenshot |
| ... | | | | |

## Launch

### <surface>
<exact commands, env vars by name, seed and fixture steps, how to tell it is up>

## Capture recipes

### <surface>
<exact capture commands from the recipes reference, adapted; where files land; how to trim>

## Publish

<where captures are stored and the command; the link format for PR bodies>

## Exemptions

<surface: reason>, or `none`

## Per-change checklist

1. Launch the surface the change touches, from a local build at HEAD.
2. Drive the exact behaviour each acceptance criterion names, using the surface's recorded tier. When the change alters existing behaviour, drive it before and after.
3. Capture a still for a state, a recording for a flow, a transcript for a CLI or API, and side-by-side images for before and after.
4. Publish, and link each capture from the PR's Evidence section with the HEAD SHA it came from.
```

Keep it under 150 lines, with commands that run as pasted. Leave the architecture out.

Complete when `EVIDENCE.md` exists, every surface from step 1 is in the table, and each capture recipe names the file it produces.

## 3. Prove it

Pick one small existing feature and run the checklist end to end: launch, drive, capture, publish. If a step fails, fix `EVIDENCE.md` and rerun that step.

Complete when the capture is published and its link works.

## Report

- The `EVIDENCE.md` path and the surfaces it covers.
- The sample capture's link and the command that produced it.
- Exemptions and their reasons.
- Tools the document assumes that are not installed, if any.

## Plan mode (`/evidence plan <feature>`)

Read `EVIDENCE.md`, name the surface the feature lives on, and return the launch, drive and capture commands for that feature, with the file names the captures will have. Leave the document unchanged. When `EVIDENCE.md` is missing, say so and offer to write it.
