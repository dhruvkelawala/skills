# Verifier launch policy: source walkthrough and live CLI proof

Captured against implementation commit 36ba56696703775665755cddad1fe98c9641fe7a, base 2cf5a22b0c83f799c8fa383d78bf5adc3f52ed10.

The adjacent before-after.txt was produced by running `node replay.mjs <skills-repository-root>`. The script imports the real base and head gate, reads the actual model configuration, and invokes the real ship verdict CLI against a local Git repository. Only external GitHub responses are fixtures; it makes no network writes.

## Launch and repair trace

1. issue-to-pr stage 6 sends a draft back through the same gate with `--for-verification`, the expected pushed SHA, and the configured reviewer/check/held arguments. The replay shows the old gate returning draft blockers while the new mode exposes missing bot coverage as pending. After current-head coverage arrives, verification is ready while merging the draft remains blocked.
2. issue-to-pr stage 7 calls ship verify. Ship verify step 1 reaches ship/references/verification.md before creating a child. The reference settles the pushed head, obtains exact-head readiness, and calls the existing verdict check with the same trust flags.
3. The live verdict CLI records an independent fixture PASS, returns `current`, retains `current` after a same-patch restack over an unrelated base change, and returns `stale` after the patch changes. The source policy uses `current` with valid proof for reuse, and missing/stale/failed for a new run after readiness. A fresh user request or concrete proof invalidation still requires a new run.
4. Before a new child, the shared reference specifies the acceptance criteria, published SHA, relevant paths, recipe and safety assumption. Ship's existing gates, live behavior and blast-radius lanes remain required.
5. The shared repair branch retains useful partial evidence, cancels an invalidated attempt before editing its checkout, batches and pushes accepted patch-changing repairs, then re-enters readiness. issue-to-pr returns through stage 6; ship FAILs return through preparation. A finding alone, rejected nit, same-commit CI retry or same-patch restack does not justify a replacement.
6. pr-review's direct verifier entry now points to the same preparation. Ship land retains its ordinary required-check wait; a stale required verdict returns through ship verify.
7. The shared policy and run-record reference require reused/deferred/new, reason, head, criteria and proof, plus child/model/effort for a new run.

## Safety and limits

The replay demonstrates missing required CI, failed CI, a moved pushed head and unexplained BLOCKED states holding verification. An inaccessible required-rule inventory now yields unknown/pending, checked through the public CLI fixture. The new mode also retains findings, held replies, unknown/truncated data and configured reviewer coverage through the existing gate. The normal merge gate remains unchanged. GitHub can hide behind-base information under DRAFT or BLOCKED, so verification readiness cannot prove freshness from that state alone; expected rebases settle before launching, and merge readiness still applies later.

Workflow dispatch, cancellation, brief bounds and proof relevance are agent instructions reviewed against their callers. This walkthrough and the deterministic CLI run do not establish that every future agent follows them. No production quota saving or model-quality improvement is claimed.

Verification at this implementation: `node --test` — 251 passed; `python3 skills/cleanup/scripts/test-worktree-audit.py` — PASS; `python3 skills/cleanup/scripts/test-artifact-audit.py` — PASS; `git diff --check` — PASS. No configured lint, typecheck, build or CI workflow found. Manual model-provider experiments were not run. EVIDENCE.md is absent; the repository should adopt one.
