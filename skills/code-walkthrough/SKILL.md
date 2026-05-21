# Code Walkthrough

Guided codebase review for engineers inheriting or auditing agent-written (or unfamiliar) codebases. Walk every file, fix as you go, maintain a living checklist, and produce a visual handbook.

## When to use

- New to a codebase and want to understand it systematically
- Pre-release audit of agent-built code
- Onboarding onto a project you didn't write
- User says "walk me through this codebase", "review this codebase", "I want to understand this code"

## Principles

1. **Human sets the pace.** Never mark a file as reviewed until the user says they're done. Never skip ahead. Wait for "next", "lgtm", "continue".
2. **Fix as you go.** Don't collect a list of 50 findings for later. Fix small things immediately, commit, move on. Bigger items get GitHub issues.
3. **One file at a time.** Open it, summarize it in 1-2 lines, let the user read. Respond to their questions. Don't dump analysis unprompted.
4. **Commit early, commit often.** Each fix or refactor gets its own commit with a clear message. Keep the branch deployable.
5. **Tests must pass after every change.** Run typecheck + tests before every commit. No exceptions.

## Workflow

### Phase 1 — Orientation (do this first, always)

1. **Read project context.** Check for `CONTEXT.md`, `AGENTS.md`, `README.md`, `docs/`. Understand what the project does, its stack, and module boundaries.

2. **Map the structure.** `find` the monorepo packages, key directories, entry points. Count test files, CI config, schema files.

3. **Generate the handbook.** Use the `visual-explainer` skill to build a self-contained HTML page covering:
   - KPIs (package count, test count, API routes, etc.)
   - Module map with descriptions and key exports
   - Data flow diagram (Mermaid with zoom/pan)
   - Per-package file tables with review priority
   - Database schema (ER diagram if applicable)
   - Country/feature support matrix (if applicable)
   - Test distribution and CI pipeline
   - Recommended review order
   - "Things to watch for" cards

   Deploy the handbook somewhere accessible (Cloudflare Pages, Vercel, or local server) so the user can reference it on another screen.

4. **Create `REVIEW.md`** at the repo root. This is the living checklist:
   ```markdown
   # Codebase Review Checklist
   
   Branch: `review/your-branch-name`
   
   ## package-name/src/
   
   - [ ] `file.ts`
   - [ ] `other-file.ts`
   
   ## Findings (fix as we go)
   
   1. ~~thing fixed~~ ✅
   2. thing noted for later (#issue-number)
   ```

5. **Create a review branch.** All changes happen here. Keep main clean.

### Phase 2 — File-by-file review

For each file, follow this protocol:

1. **Introduce the file.** One line: what it does and where it's used. Example:
   > `confidence.ts` — Calculates counter acceptance confidence score (0-100) from validation results, profile data, and consistency checks. Used by `/api/confidence-score` route.

2. **Open the file.** Use `Read`. Let the user read it.

3. **Wait.** Do not dump analysis. The user will ask questions or point things out. Respond to what they ask.

4. **When the user flags something:**
   - If it's a quick fix (deprecated API, duplicated const, missing type): fix it now, run tests, commit.
   - If it's a refactor (break up large function, extract file): do it, run tests, commit.
   - If it's a design concern (wrong abstraction, missing feature): create a GitHub issue.
   - If it's cosmetic and not worth changing: note in REVIEW.md, move on.

5. **When the user says "next" / "lgtm" / "continue":**
   - Update REVIEW.md with a one-line summary of findings for that file.
   - Open the next file.

6. **Never say "Your file." or "Take your time."** Just open the file and wait. If the user told you to stop saying something, stop permanently.

### Phase 3 — Ongoing maintenance

- **Update the handbook** periodically with review progress (files reviewed, commits made, issues created). Redeploy.
- **Update REVIEW.md** after every file. This is the source of truth for progress.
- **Push commits regularly.** Don't accumulate uncommitted changes.
- **Run full test suite** periodically (not just per-package).

## Review order heuristic

Start with the lowest-dependency package and work outward:

1. **Types/schemas** — the vocabulary everything else speaks
2. **Pure business logic** — rules, validators, scorers (no framework deps, easy to verify)
3. **Core engine** — the main domain logic (PDF generation, data processing, etc.)
4. **Integration layer** — how packages connect (API routes, state management)
5. **UI components** — frontend, last because it depends on everything above
6. **Tests** — review alongside the code they test, not separately
7. **Dev tooling** — CLI tools, calibration, scripts — skip or skim for beta

Within each package, start with the barrel file (`index.ts`), then types, then core logic, then helpers.

## Fix patterns

### Deprecated APIs
Find all instances across the codebase, fix all at once, single commit.
```
grep -rn 'deprecated_thing' packages/ apps/ --include='*.ts'
```

### Duplicated constants/types
Extract to a shared location, update all imports, single commit.

### Large functions
Break into smaller functions. Keep the same tests passing — this is a refactor, not a rewrite.

### Hardcoded data that should derive from a source of truth
Replace with computed/derived version. Watch for type narrowing issues (e.g. `.filter().map()` loses narrow types — may need a const tuple or explicit type).

### Unsafe type casts
Tighten the type at the source (function signature) rather than casting at the callsite.

### Dead code / unused types
Verify with `grep`, then remove. Commit separately.

## Commit message format

```
type(scope): short description

Longer explanation if needed.
```

Types: `fix`, `refactor`, `docs`, `chore`, `style`
Scope: package name or area (`schemas`, `form-engine`, `rules`, `web`)

Examples:
- `fix(schemas): use z.email() instead of deprecated z.string().email()`
- `refactor(rules): break runConsistencyChecks into per-document functions`
- `chore: update @libpdf/core 0.3.4 → 0.3.6`
- `docs(form-engine): add JSDoc to fill.ts helper functions`

## Branch management

When formatting/linting setup is needed:
1. Add tooling (prettier, eslint plugins, husky) on main
2. Run formatting on main, commit separately
3. Push main
4. Rebase review branch on formatted main

This keeps the review PR diff clean — only logic changes, no formatting noise.

## GitHub issues

Create issues for things that are:
- Too risky to change pre-beta
- Require design decisions
- Are tech debt but not bugs

Template:
```markdown
## Problem
What's wrong, with code reference.

## Fix
Proposed solution.

## Found during
Pre-beta codebase review (branch `review/...`)
```

## What NOT to do

- Don't dump a wall of findings when opening a file
- Don't mark files as reviewed before the user confirms
- Don't skip files because they "look fine"
- Don't refactor things the user didn't ask about
- Don't accumulate changes without committing
- Don't run `git add -A` — be explicit about which files you're committing
- Don't move faster than the user — this is their review, you're the guide
