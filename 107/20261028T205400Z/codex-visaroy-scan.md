# #107: what Codex's Visaroy runs wrote, baseline and #134

#141 ran `run.mjs visaroy` on Codex three times at main (`b59ad16`) and three times at #134's head (`a128015`). #134's rebased head carries the same skill text: the rebase changed only `evals/results.md`. A scratch scan read the verify skill each run wrote. Scores are from `skills/verification-skill/evals/results.md`.

| Run folder | Skill | Score | Hazards section | Inventory table | Process group at launch | Survivor check |
| --- | --- | --- | --- | --- | --- | --- |
| visaroy-20261028T111632Z | `b59ad16` | 10.5 | no | no | yes | no |
| visaroy-20261028T114431Z | `b59ad16` | 11.5 | no | no | yes | no |
| visaroy-20261028T121511Z | `b59ad16` | 11.5 | no | no | no | no |
| visaroy-20261028T130657Z | `a128015` | 13.5 | yes | yes, 11 rows | yes | yes |
| visaroy-20261028T134832Z | `a128015` | 12.5 | yes | yes, 12 rows | yes | yes |
| visaroy-20261028T143724Z | `a128015` | 13.5 | yes | yes, 9 rows | yes | yes |

Means: 11.17 at main, 13.17 at #134, out of 19. Lore wasn't run on Codex at #134.
