# AC5 before: the README's Installation section at base 4a345b2

$ git show 4a345b2:README.md | sed -n '/^## Installation/,/^## Credits/p'
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

