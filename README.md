# skills

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Run autoreview, commit, push, and open or update a ready-for-review PR. |
| [bro](skills/bro/SKILL.md) | Restate the last message in plain human language, with no jargon. |
| [code-walkthrough](skills/code-walkthrough/SKILL.md) | Guided codebase review for engineers inheriting or auditing agent-written or unfamiliar codebases. |
| [implement](skills/implement/SKILL.md) | Implement or delegate a single GitHub issue, Linear ticket, or current plan as a small, reviewable vertical slice. |
| [research-explainer](skills/research-explainer/SKILL.md) | Research a topic against primary sources via background agents, then generate a self-contained HTML field guide that teaches it from scratch. |
| [use-clawpatch](skills/use-clawpatch/SKILL.md) | Run clawpatch automated code review: map features, review for findings, fix issues, revalidate, and track progress. |

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
    "git:github.com/dhruvkelawala/skills/skills/use-clawpatch"
  ]
}
```

## License

MIT
