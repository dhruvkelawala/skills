$ git show 4a345b2:README.md | grep -n 'skills/ticket/SKILL.md'
(exit 1: no row at base 4a345b2)

$ grep -n -B1 -A1 '\[ticket\](skills/ticket/SKILL.md)' README.md   # at 32fc339
27-| [test-audit](skills/test-audit/SKILL.md) | Gate each new or changed test on the behaviour it protects and the bug that fails it, reject duplicate, tautological and implementation-coupled tests, and prune a suite with a per-test ledger. `issue-to-pr` runs its gate on every test it writes. |
28:| [ticket](skills/ticket/SKILL.md) | Turn one idea or ask from the thread into one GitHub or Linear issue, labelled `ready-for-agent` only when its criteria are clear and otherwise naming what's missing, with a one-line reply and the link. A spec that splits into many tickets goes to `to-tickets`. |
29-| [verification-skill](skills/verification-skill/SKILL.md) | Write a project-local `verify-<app>` skill that launches, health-checks and drives the real app with a feature map (`create`), or check every feature from source and live (`check`). (pstack) |

$ test -f skills/ticket/SKILL.md && echo link resolves
link resolves
