# skills

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Autoreview from a pinned base, commit, push, open or update a ready-for-review PR, then watch and repair PR review findings until clean. |
| [bro](skills/bro/SKILL.md) | Restate the last message in plain human language, with no jargon. |
| [code-walkthrough](skills/code-walkthrough/SKILL.md) | Paced, file-by-file review of an unfamiliar or agent-written codebase, fixing as you go with a living checklist. |
| [eli25](skills/eli25/SKILL.md) | Explain a PR, stack, plan, spike, system or incident as a short visual page shaped by its topic, optionally hosted on Tailscale or Vercel. |
| [evidence](skills/evidence/SKILL.md) | Write a repo's EVIDENCE.md: how to launch each surface, drive a feature, capture screenshots, recordings, or transcripts, and publish them so PRs can prove changes work. |
| [explain-diff](skills/explain-diff/SKILL.md) | Explain a diff, commit, branch, or PR in plain words: the problem, the key idea, and one real input traced through the changed code. |
| [hillclimb](skills/hillclimb/SKILL.md) | Raise one score toward a target (speed, a critic or eval score, a pass rate, a size) with one change per attempt, keep or revert, and a log. You judge taste scores at checkpoints. (pstack) |
| [how](skills/how/SKILL.md) | A short answer to how code or a PR works, or where a change belongs, with one real input traced through the code at `path:line`. (pstack) |
| [idea-foundry](skills/idea-foundry/SKILL.md) | Generate or pressure-test ambitious project ideas through research, scoring, red-teaming, and pitching. |
| [issue-to-pr](skills/issue-to-pr/SKILL.md) | Take one GitHub issue or Linear ticket to a PR: test-first build, at most two review passes, a captured proof per criterion, a `pr`-format body, and a time-boxed watch, standalone or stacked. `resume` picks up new reviews and moved predecessors. |
| [perf](skills/perf/SKILL.md) | Make one slow thing faster: measure, name the limiter, make one cheapest-first fix, and measure again. `baseline` only measures; `diagnose` explains a live process or a profile without changing code. (pstack) |
| [pr](skills/pr/SKILL.md) | Write a PR body that is fast to review: a diagram summary, before and after evidence, and merge danger with a one-way or two-way door and the blast radius. |
| [pr-review](skills/pr-review/SKILL.md) | Review a PR, a stack, or your review queue one PR at a time: the few architecture and system-design changes to judge, each with a before-and-after sketch and the question to answer, then findings and a suggested verdict. `try` runs the PR for you to test by hand; implementation detail on request. |
| [pr-watch](skills/pr-watch/SKILL.md) | Poll a PR until CI is green, review threads are resolved, and each configured review agent has covered the current HEAD, repairing findings in between. |
| [product-description](skills/product-description/SKILL.md) | Build a prose "product description" repo describing what the user sees and exactly what happens when they act, drafted from code and tests, then verified and triaged into a bug list. |
| [promote](skills/promote/SKILL.md) | Turn repeated or severe agent corrections from PRs, run records, transcripts and memory files into the highest check that can stop them, each proven on a past mistake and listed in a rule table. `--report-only` serves issue-to-pr. (pstack) |
| [recap](skills/recap/SKILL.md) | Write a two-minute brief of the session (goal, shipped, decided, in flight, next) and save it for the next session; `/recap last` reads it back with what moved since. |
| [research-explainer](skills/research-explainer/SKILL.md) | Research a topic against primary sources via background agents, then generate a self-contained HTML field guide that teaches it from scratch. |
| [review-ready](skills/review-ready/SKILL.md) | Completion gate for code changes: checks a design contract (readable entry points, deep modules, real seams, tests through the interface, comment rules) and writes the gate report. |
| [ship](skills/ship/SKILL.md) | Order the review queue by what each PR unblocks, record an independent verdict pinned to each PR's patch, and land only the verified run of a stack, bottom up. Works with one GitHub account. (pstack) |
| [verification-skill](skills/verification-skill/SKILL.md) | Write a project-local `verify-<app>` skill that launches, health-checks and drives the real app with a feature map (`create`), or check every feature from source and live (`check`). (pstack) |
| [verify](skills/verify/SKILL.md) | Discover and run every verification a project defines and report each as passed, failed, or could-not-run. |
| [why](skills/why/SKILL.md) | Why code or a decision looks the way it does, from git and the PR with a confidence word, or why the agent took an action this session. `--deep` searches every source. (pstack) |
| [worktree-cleanup](skills/worktree-cleanup/SKILL.md) | Read-only audit of git worktrees and iOS simulators, then removal by approved bucket, with a hold list for anything that could lose work. Branch deletion is a separate approval. (pstack) |

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

Skills marked (pstack) are adapted for Pi from [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed, at `cursor/plugins@fae2c6e` or later; each skill's attribution line names its exact commit. Each carries the upstream license in its directory. `promote` adapts pstack's `reflect` and `correct`. `pr` adapts HumanLayer's PR template and Dex Horthy's show-me visuals, MIT licensed, with the license in its directory.

## License

MIT
