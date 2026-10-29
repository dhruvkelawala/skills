# Repository verification and runnable setup

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

At the captured HEAD, the full discovery found no package manifest, lint, typecheck, build target or CI workflow. Existing test files define the checks. No paid live model-evaluation batch was run.

```json
{
  "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "testFiles": 29,
  "checks": [
    {
      "name": "node",
      "command": "node --test <all 29 .test.mjs files>",
      "exit": 0
    },
    {
      "name": "worktree",
      "command": "python3 skills/cleanup/scripts/test-worktree-audit.py",
      "exit": 0
    },
    {
      "name": "artifact",
      "command": "python3 skills/cleanup/scripts/test-artifact-audit.py",
      "exit": 0
    }
  ],
  "syntax": "passed"
}
```
Exact Node summary:

```text
ℹ tests 337
ℹ suites 4
ℹ pass 337
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 35336.182791
```

Python summaries:

```text
PASS: 8 classifications, HEAD SHAs, offline safety, invalid markers, deduplication, whitespace paths, trunk, read-only
PASS: artifacts, caches, sizes, holds, read-only
```

The changed Node files passed node --check, and changed Python files passed AST parsing. Focused instrumentation tests passed11/11. The runnable default CLI returned {"status":"disabled"}. The setup and API transcripts beside this capture show the feature running at this HEAD.
