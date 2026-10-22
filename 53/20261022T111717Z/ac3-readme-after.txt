# at head a4b78d7
$ grep -E '^\| \[(pr-review|eli25)\]' README.md
| [eli25](skills/eli25/SKILL.md) | Explain a PR, stack, plan, spike, system or incident as a short visual page shaped by its topic, optionally hosted on Vercel. |
| [pr-review](skills/pr-review/SKILL.md) | Review a PR, a stack, or your review queue one PR at a time: the few architecture and system-design changes to judge, each with a before-and-after sketch and the question to answer, then findings and a suggested verdict. `try` runs the PR for you to test by hand; implementation detail on request. |
$ grep -Ei '^\| \[(pr-review|eli25)\].*(herdr|hunk|tailscale)' README.md
exit=1
