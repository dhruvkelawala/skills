# skills

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Autoreview from a pinned base, commit, push, open or update a ready-for-review PR, then watch and repair PR review findings until clean. |
| [bro](skills/bro/SKILL.md) | Restate the last message in plain human language, with no jargon. |
| [build](skills/build/SKILL.md) | Implement one issue, ticket, plan, or confirmed contract as test-first vertical slices from a pinned base, one commit per slice, with review left to /code-review and /apr. |
| [code-walkthrough](skills/code-walkthrough/SKILL.md) | Paced, file-by-file review of an unfamiliar or agent-written codebase, fixing as you go with a living checklist. |
| [create-verification-skill](skills/create-verification-skill/SKILL.md) | Generate a project-local `verify-<app>` skill that launches, health-checks, and drives the real app, with a maintained feature map; proves itself on one feature. (pstack) |
| [eli25](skills/eli25/SKILL.md) | Explain a topic simply and visually to a software engineer as a neo-brutalist HTML page, optionally deployed to Tailscale or Vercel. |
| [evidence](skills/evidence/SKILL.md) | Write a repo's EVIDENCE.md: how to launch each surface, drive a feature, capture screenshots, recordings, or transcripts, and publish them so PRs can prove changes work. |
| [explain-diff](skills/explain-diff/SKILL.md) | Explain a diff, commit, branch, or PR in plain words: the problem, the key idea, and one real input traced through the changed code. |
| [forensics](skills/forensics/SKILL.md) | Diagnosis-only investigation: capture a live CPU spin, leak, or glitch (runtime mode) or explain a supplied profile or trace (trace mode), with cited findings. (pstack) |
| [hillclimb](skills/hillclimb/SKILL.md) | Bounded keep-or-revert experiment loop on one metric against a target, with a frozen harness, decision log, and one commit per accepted win. (pstack) |
| [how](skills/how/SKILL.md) | Explain how a subsystem works or where a change belongs: one input traced end to end, owners, registration seams, and placement tradeoffs. (pstack) |
| [idea-foundry](skills/idea-foundry/SKILL.md) | Generate or pressure-test ambitious project ideas through research, scoring, red-teaming, and pitching. |
| [issue-to-pr](skills/issue-to-pr/SKILL.md) | Take one GitHub issue end to end into a merge-ready PR by chaining /build, /code-review until clean, /verify, /apr, and /pr-watch, standalone or stacked. |
| [maintain-verification-skill](skills/maintain-verification-skill/SKILL.md) | Keep a verify skill honest: source-read every feature, drive every feature live, and ship at most one set of proven map corrections. (pstack) |
| [no-comments](skills/no-comments/SKILL.md) | Comment Sicko review: remove comment noise, keep proven exceptions and `ponytail:` markers, and offer structural encodings for claimed constraints. (pstack) |
| [perf](skills/perf/SKILL.md) | Measurement-first optimization: pin the workload, baseline with a profile, test one hypothesis, accept only wins beyond noise. (pstack) |
| [pr-review](skills/pr-review/SKILL.md) | Review a PR, a stack, or your review queue one PR at a time: a read, skim, or skip triage, a plain explanation with a code trace, findings with a suggested verdict, and one batched review. Stops become Hunk notes inside Herdr. |
| [pr-watch](skills/pr-watch/SKILL.md) | Poll a PR until CI is green, review threads are resolved, and each configured review agent has covered the current HEAD, repairing findings in between. |
| [product-description](skills/product-description/SKILL.md) | Build a prose "product description" repo describing what the user sees and exactly what happens when they act, drafted from code and tests, then verified and triaged into a bug list. |
| [promote](skills/promote/SKILL.md) | Turn recurring or severe agent corrections into structural issues, tested static checks, or approval-only instruction diffs at the highest enforceable layer. |
| [recap](skills/recap/SKILL.md) | Write a two-minute brief of the session (goal, shipped, decided, in flight, next) and save it for the next session; `/recap last` reads it back with what moved since. |
| [research-explainer](skills/research-explainer/SKILL.md) | Research a topic against primary sources via background agents, then generate a self-contained HTML field guide that teaches it from scratch. |
| [review-ready](skills/review-ready/SKILL.md) | Completion gate that enforces a design contract (deep modules, narrative entry points, real seams, interface-oriented tests) and produces a review-ready report before handing work back. |
| [verify](skills/verify/SKILL.md) | Discover and run every verification a project defines and report each as passed, failed, or could-not-run. |
| [why](skills/why/SKILL.md) | Recover why code took its shape from history across source control, trackers, docs, chat, and telemetry, with a confidence tier on every claim. (pstack) |
| [worktree-cleanup](skills/worktree-cleanup/SKILL.md) | Read-only audit of every git worktree and simulator, then remove only individually approved items; never deletes branches without separate approval. (pstack) |

## Installation

Add to your Pi `settings.json`:

```json
{
  "packages": [
    "git:github.com/dhruvkelawala/skills"
  ]
}
```

Or install a single skill:

```json
{
  "skills": [
    "git:github.com/dhruvkelawala/skills/skills/apr"
  ]
}
```

## Credits

Skills marked (pstack) are adapted for Pi from [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed, at `cursor/plugins@fae2c6e`. Each carries the upstream license in its directory. `promote`'s session-mining lenses are adapted from pstack's `reflect`.

## License

MIT
