# pi-skills

Agent skills for [Pi](https://github.com/anthropics/pi).

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Run autoreview, commit, push, and open or update a ready-for-review PR. |
| [implement](skills/implement/SKILL.md) | Implement a single GitHub issue or Linear ticket as a small, reviewable vertical slice. |
| [use-clawpatch](skills/use-clawpatch/SKILL.md) | Run clawpatch automated code review: map features, review for findings, fix issues, revalidate, and track progress. |

## Installation

Add to your Pi `settings.json`:

```json
{
  "packages": [
    "git:github.com/dhruvkelawala/pi-skills"
  ]
}
```

Or install a single skill:

```json
{
  "skills": [
    "git:github.com/dhruvkelawala/pi-skills/skills/use-clawpatch"
  ]
}
```

## License

MIT
