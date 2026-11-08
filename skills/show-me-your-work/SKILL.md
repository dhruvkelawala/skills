---
name: show-me-your-work
description: Use for /show-me-your-work, long or unattended runs, or a release manager's merge digest. Keeps an append-only decision log with reasons, evidence and observed results, then audits the trail before handoff.
---

# Show me your work

Keep one canonical TSV log for decisions and checkpoints, including rejected approaches, repairs and blockers. It accompanies the existing T3 run record; it does not replace the build state or start another scheduler.

## 1. Start or resume

Keep `decisions.tsv` outside Git, beside the run record or under `~/.agent/show-me-your-work/<repo>/<run-id>/`. Record its path and the owning thread or run ID in that record. On resume, read its last rows before appending. A different run gets a different log and a pointer to its predecessor. Only the parent writes its log; parallel workers return proposed entries with evidence.

The header in [decision-log-template.tsv](references/decision-log-template.tsv) defines six single-line cells:

| Column | Value |
| --- | --- |
| ts | UTC ISO8601 timestamp |
| phase | Workstream or checkpoint |
| decision | What was chosen or done |
| why | The reason in plain words |
| evidence | Resolving path, commit, PR or capture link |
| result | Observed outcome, or `open` / `INCONCLUSIVE` |

Complete when the run record points to one log and identifies its owner.

## 2. Append at decision points

Run the helper with its interpreter, from any directory:

```sh
bash <skills-dir>/show-me-your-work/scripts/log.sh <logfile> <phase> <decision> <why> <evidence> <result>
```

Quote each argument. The helper creates the directory and header, rejects a mismatched existing header, strips tabs and line breaks, and quotes spreadsheet formula prefixes, including after whitespace. It preserves earlier rows. Run its checks with `node --test <skills-dir>/show-me-your-work/scripts/log.test.mjs`.

Log a meaningful choice, completed phase, failed check, pivot, revert or blocker when it happens. For an iterative run, log each iteration. Record the actual result; a planned check stays `open`. Prefer evidence produced by the repo's runnable tools. [Unslop](../unslop/SKILL.md) applies to the row text too.

Corrections append a new row naming the superseded row by timestamp and decision. Keep the original. Review rows for private data before publishing; retain the private canonical log and make a separate sanitized excerpt when needed.

Complete when every material decision so far has a row, evidence pointer and honest result.

## 3. Audit before handoff

Compare this run's rows with its actual transcript or tool records. In T3, read only the owning thread's messages and activity; in another host, use its scoped history. Open each cited artifact and check the result it claims. Append missing pivots and corrections. If history or evidence is unavailable, mark the audit incomplete and name what could not be checked.

For a long or unattended run, give a fresh read-only helper the log, this run's scoped transcript and evidence, and ask for weak evidence, skipped verification, risky choices and omissions. Use the `artifact-review` job from [models.json](../models.json) through [model-policy](../model-policy/SKILL.md). Share only this run's material. Report the actual reviewer and any fallback; an unavailable independent audit remains a gap.

Complete when the self-audit and independent audit have results or named gaps, and corrections are appended.

## Merge digest

The release manager reads this format directly. Link the log, owning run, PR and tested head; summarize only decisions that affect the merge. Keep a short table with the decision, reason, evidence and result. Carry unresolved blockers and unproven safety facts into the digest even when tests pass. Link [blast-radius](../blast-radius/SKILL.md) proof rather than repeating it.

End the handoff with `Attention: <reviewer, flags with row pointers, or no flags>`. For an incomplete audit, say `not independently audited` and name the gap. A digest drafts information for the existing release workflow; it grants no permission to merge or message anyone. Commit a sanitized log only when the user asks or the owning workflow requires it.

Adapted from pstack's show-me-your-work by Lauren Tan (MIT), [cursor/plugins@1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def](https://github.com/cursor/plugins/tree/1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def/pstack). Upstream license: [LICENSE](LICENSE).
