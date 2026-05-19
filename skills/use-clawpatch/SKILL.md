---
name: use-clawpatch
description: >
  Run clawpatch automated code review: map features, review for findings, fix
  issues, revalidate, and track progress in an HTML dashboard. Use when user
  mentions clawpatch, automated code review, security audit, finding fixes,
  "review the codebase", or wants to run semantic code analysis and remediation
  loops. Also use when a .clawpatch/ directory or report file is referenced.
---

# Use Clawpatch

Clawpatch is a semantic code review tool. It maps a repo into feature records
(routes, packages, source groups, configs), reviews each with an AI provider,
and produces typed findings with severity, evidence, and recommendations.

## Preflight

```bash
command -v clawpatch       # installed?
clawpatch doctor           # provider (Codex CLI) reachable?
ls .clawpatch/config.json  # already initialized?
```

If not initialized:

```bash
clawpatch init   # detects project type, creates .clawpatch/
clawpatch map    # builds semantic feature map
```

## Core loop: review → fix → revalidate

This is the primary workflow. Repeat until `clawpatch review` produces 0 findings.

### 1. Review

```bash
clawpatch review --limit 10
```

Produces a markdown report at `.clawpatch/reports/<run-id>.md` and persists
findings in `.clawpatch/findings/`.

### 2. Read the report

```bash
cat .clawpatch/reports/<latest>.md
```

Each finding has: id, severity, category, status, evidence (file:line), reasoning,
recommendation, suggested regression test, and minimum fix scope.

### 3. Fix all open findings

For each finding with `status: open`:

1. Read the evidence files at the cited lines
2. Apply the fix directly (edit the source code yourself)
3. Run `pnpm typecheck` (or project equivalent) to verify no type errors
4. Run relevant tests to verify nothing broke

**Do NOT use `clawpatch fix --finding <id>`** — it shells out to Codex which is
slow and may hit rate limits. Fix the code yourself, then revalidate.

### 4. Revalidate each finding

```bash
clawpatch revalidate --finding <finding-id>
```

Outcomes:
- **fixed** — finding resolved, move on
- **open** — still present, read the reasoning and fix what's missing
- **uncertain** — usually means tests added but coverage is borderline; acceptable

If `open`, read the `reasoning:` field — it explains exactly what's still wrong.
Fix and revalidate again.

### 5. Repeat

Run `clawpatch review --limit 10` again. It reviews the next batch of unmapped
features. Continue until a review round produces 0 findings.

## Fixing patterns (learned from experience)

### What revalidation actually checks

The revalidator inspects current source code, runs tests if available, and
checks whether the original evidence still exists. It's thorough:

- Verifies the exact code pattern is gone, not just the file
- Checks transitive dependencies (e.g., bun-types pulling @types/node@25)
- Validates that runtime behavior changed, not just TypeScript types
- Confirms test assertions actually exercise the fix (not just "tests exist")

### Common revalidation failures

| Failure pattern | Fix |
|----------------|-----|
| "Still falls back to spoofable headers" | Remove the fallback entirely, not just add a comment |
| "TypeScript readonly but not runtime frozen" | Add `Object.freeze` / `deepFreeze` |
| "Test exists but doesn't assert the contract" | Make tests check message roles, coordinates in content, etc. |
| "Transitive dependency still pulls wrong version" | Add pnpm `overrides` in root package.json |
| "Module mock poisons other test files" | Isolate tests with `mock.module` into separate `bun test` runs |

### mock.module isolation (Bun-specific)

Bun's `mock.module()` is process-global and persists across test files in the
same `bun test` invocation. If your test mocks a shared module (like `config`
or `sharp`), it will poison other test files.

**Fix**: Run tests with heavy mocking in separate bun invocations:

```json
{
  "test:ci": "bun test $(find src -name '*.ci.test.ts' ! -path '*/isolated/*' | sort) && bun test src/path/to/isolated.ci.test.ts"
}
```

### Turbo env var visibility

When moving env vars between `globalPassThroughEnv` and `tasks.build.env`,
remember that other tasks (like `test:ci`) won't inherit `build`'s env vars.
Add them to the test task's `passThroughEnv` if tests import modules that
read those vars at startup.

## HTML dashboard

Maintain a `clawpatch.html` at the repo root as a running log of all findings
and their resolution status. Structure:

```html
<h2>Round N — X findings (report: <code>TIMESTAMP</code>)</h2>
<table>
  <tr><th>#</th><th>Sev</th><th>Finding</th><th>Solution</th><th>Status</th></tr>
  <!-- One row per finding -->
</table>
```

Update after each round. Use severity colors:
- 🔴 high → `color: #ff8a8a`
- 🟡 medium → `color: #ffd27a`
- 🟢 low → `color: #9ee6a8`
- ✅ fixed → `color: #5fff8a`

## Git workflow

1. Create a branch: `fix/clawpatch-remediation-<date>`
2. Fix all findings from one review round
3. Commit with detailed message listing all fixes by category
4. Push and update the PR body with cumulative tables
5. Repeat for next round on the same branch
6. Only create the PR once (after round 1), then push subsequent rounds as commits

## Finding categories reference

| Category | What to look for |
|----------|-----------------|
| `security` | Auth gaps, leaked secrets, SSRF, path traversal, spoofable inputs |
| `bug` | Crashes, undefined access, wrong behavior, logic errors |
| `api-contract` | Type promises that don't match runtime, unused props/options |
| `data-loss` | Non-transactional writes, missing FK checks, corrupt state |
| `build-release` | Stale caches, wrong version types, broken scripts |
| `test-gap` | Missing coverage for external boundaries, error paths |
| `maintainability` | Dead code, duplicate logic, misleading naming |
| `performance` | N+1 queries, unbounded allocations, missing pagination |
| `concurrency` | Race conditions, stale closures, missing locks |

## Commands reference

| Command | Purpose |
|---------|---------|
| `clawpatch init` | Initialize project, detect config |
| `clawpatch map` | Build semantic feature map |
| `clawpatch status` | Show project/review state |
| `clawpatch review --limit N` | Review N features, produce findings |
| `clawpatch report` | Generate markdown report from findings |
| `clawpatch revalidate --finding ID` | Re-check a specific finding |
| `clawpatch fix --finding ID` | Apply AI-generated fix (prefer manual fixes) |
| `clawpatch doctor` | Check environment setup |
