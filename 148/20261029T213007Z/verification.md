# Verification after the installed-path repair

HEAD `9e3bd8337bc17f42131e183987ce4fe4124438a6`, tree `15e7c4f47a2149f7be358fd98f4cb1b13f758488`.

Full verification passed 339 Node tests across 30 test files, four suites, plus both Python cleanup fixture suites and changed Node/Python syntax checks. The new installed CLI case passed after failing on empty output before the fix. No additional lint, typecheck, build or hosted CI commands are defined. No paid model evaluation batch ran.

```json
{
  "basis": "full verification of committed head after installed symlink repair",
  "testFiles": 30,
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
        "skills/verification-skill/scripts/record.test.mjs",
        "skills/issue-to-pr/scripts/observe.test.mjs"
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
  "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "tree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488"
}
```

