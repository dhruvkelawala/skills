# skills

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Autoreview from a pinned base, commit, push, open or update a ready-for-review PR, then watch and repair PR review findings until clean. |
| [build](skills/build/SKILL.md) | Implement one issue, ticket, plan, or confirmed contract as test-first vertical slices from a pinned base, one commit per slice, with review left to /code-review and /apr. |
| [bro](skills/bro/SKILL.md) | Restate the last message in plain human language, with no jargon. |
| [code-walkthrough](skills/code-walkthrough/SKILL.md) | Paced, file-by-file review of an unfamiliar or agent-written codebase, fixing as you go with a living checklist. |
| [eli25](skills/eli25/SKILL.md) | Explain a topic simply and visually to a software engineer as a neo-brutalist HTML page, optionally deployed to Tailscale or Vercel. |
| [evidence](skills/evidence/SKILL.md) | Write a repo's EVIDENCE.md: how to launch each surface, drive a feature, capture screenshots, recordings, or transcripts, and publish them so PRs can prove changes work. |
| [explain-diff](skills/explain-diff/SKILL.md) | Explain a diff, commit, branch, or PR in plain language as a fixed teaching spine with a concrete end-to-end trace; the spine source for visual-diff. |
| [hunk-walkthrough](skills/hunk-walkthrough/SKILL.md) | Numbered, story-ordered walkthrough of a PR diff: attached as Hunk notes in a Herdr tab or split, or as clickable file:line references in Claude Code, Codex, or T3Code. |
| [idea-foundry](skills/idea-foundry/SKILL.md) | Generate or pressure-test ambitious project ideas through research, scoring, red-teaming, and pitching. |
| [issue-to-pr](skills/issue-to-pr/SKILL.md) | Take one GitHub issue end to end into a merge-ready PR by chaining /build, /code-review until clean, /verify, /apr, and /pr-watch, standalone or stacked. |
| [product-description](skills/product-description/SKILL.md) | Build a prose "product description" repo describing what the user sees and exactly what happens when they act, drafted from code and tests, then verified and triaged into a bug list. |
| [pr-watch](skills/pr-watch/SKILL.md) | Poll a PR until CI is green, review threads are resolved, and each configured review agent has covered the current HEAD, repairing findings in between. |
| [recap](skills/recap/SKILL.md) | Write a two-minute brief of the session (goal, shipped, decided, in flight, next) and save it for the next session; `/recap last` reads it back with what moved since. |
| [research-explainer](skills/research-explainer/SKILL.md) | Research a topic against primary sources via background agents, then generate a self-contained HTML field guide that teaches it from scratch. |
| [review-ready](skills/review-ready/SKILL.md) | Completion gate that enforces a design contract (deep modules, narrative entry points, real seams, interface-oriented tests) and produces a review-ready report before handing work back. |
| [verify](skills/verify/SKILL.md) | Discover and run every verification a project defines and report each as passed, failed, or could-not-run. |
| [visual-diff](skills/visual-diff/SKILL.md) | Explain a diff, commit, branch, range, or PR as a polished self-contained HTML visual story with diagrams and a before/after narrative. |

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

## License

MIT
