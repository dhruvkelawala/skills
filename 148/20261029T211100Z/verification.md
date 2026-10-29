# Final verification and delivery deadline

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

Full verification ran on the working tree that became this commit, with no intervening source change. The recorded tree matches HEAD exactly. No code changed during this evidence refresh.

```json
{
  "basis": "verified working tree matches committed tree; no code change between verification and commit",
  "testFiles": 29,
  "checks": [
    {
      "name": "node",
      "command": [
        "node",
        "--test",
        "instrumentation/test/accounting.test.mjs",
        "instrumentation/test/contract.test.mjs",
        "instrumentation/test/delivery.test.mjs",
        "instrumentation/test/external.test.mjs",
        "instrumentation/test/privacy.test.mjs",
        "instrumentation/test/queries.test.mjs",
        "instrumentation/test/workflow.test.mjs",
        "scripts/sync-skills.test.mjs",
        "skills/day/scripts/morning.test.mjs",
        "skills/day/scripts/strain.test.mjs",
        "skills/evidence/scripts/mark.test.mjs",
        "skills/evidence/scripts/publish-evidence.test.mjs",
        "skills/issue-to-pr/scripts/after-merge.test.mjs",
        "skills/issue-to-pr/scripts/autoreview-plan.test.mjs",
        "skills/issue-to-pr/scripts/land.test.mjs",
        "skills/issue-to-pr/scripts/messages.test.mjs",
        "skills/issue-to-pr/scripts/pr-body.test.mjs",
        "skills/issue-to-pr/scripts/repairs.test.mjs",
        "skills/issue-to-pr/scripts/required-review.test.mjs",
        "skills/issue-to-pr/scripts/spec.test.mjs",
        "skills/models.test.mjs",
        "skills/pr-review/scripts/queue.test.mjs",
        "skills/pr-watch/scripts/held.test.mjs",
        "skills/pr-watch/scripts/pr-gate.test.mjs",
        "skills/pr-watch/scripts/secrets.test.mjs",
        "skills/ship/scripts/ship.cli.test.mjs",
        "skills/ship/scripts/ship.test.mjs",
        "skills/verification-skill/evals/run.test.mjs",
        "skills/verification-skill/scripts/record.test.mjs"
      ],
      "exit": 0
    },
    {
      "name": "worktree",
      "command": [
        "python3",
        "skills/cleanup/scripts/test-worktree-audit.py"
      ],
      "exit": 0
    },
    {
      "name": "artifact",
      "command": [
        "python3",
        "skills/cleanup/scripts/test-artifact-audit.py"
      ],
      "exit": 0
    }
  ],
  "syntax": "passed",
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "tree": "7346052301582e370b4ff289266ab57d7a6d398a"
}
```

The Node summary was 338 tests passed, zero failed, across 29 test files. Both Python cleanup fixture suites passed. Changed Node syntax and Python AST checks passed. Focused instrumentation had 12 passing cases. The repo defines no separate lint, typecheck, build or hosted CI commands. No paid live evaluation batch ran.

The final regression seeds 2,000 acknowledged requests through the actual adapter and receiver, then starts the actual CLI under the three-second host deadline. Before the repair it failed: "new requests must reach the receiver before the 3-second host deadline". After the repair it reached the tail in 256 ms. Seeding durable receipts is outside that measured repeat-hook interval.

The current backend probes also passed accounting, stored-field suppression, rejection/restart/outage recovery, bounded hook progression, old-attempt ownership, owner read-only mapping, external artifact recheck and evidence validity. Actual monitor receipts are published separately. AC8 remains incomplete, as its dedicated blocker capture states.
