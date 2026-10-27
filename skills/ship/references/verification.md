# Prepare independent verification

Use this before every new verifier, including a replacement after repairs. `ship verify` owns this sequence; callers return here through that skill.

## Settle the pushed head

1. Finish known repairs and expected rebases together, run their focused checks, and push. The checkout must be clean and its `HEAD` must equal the published PR head. A local commit waiting to be pushed is not ready.
2. Resolve the same reviewers, request comment, ignored checks and held file as [pr-watch's configuration](../../pr-watch/SKILL.md#configure). Run its gate once with those arguments and the published head:

   ```bash
   node <pr-watch>/scripts/pr-gate.mjs --repo <owner/repo> --pr <n> \
     --expected-head <published-sha> --for-verification --json \
     [--reviewer <login>]... [--request-comment <text>] \
     [--ignore-check <name>]... [--held-file <path>]
   ```

   This allows a draft or pending human approval. It still requires the configured reviewers to cover this head, the CI that pr-watch counts to pass, and findings to be handled. Held replies and unknown or truncated data still hold it. Keep pr-watch's existing no-CI and optional-check rules; verification adds no bypass.
3. On a finding, batch the accepted repairs, push, and start at step 1. On pending checks or reviewer coverage, use pr-watch to request the configured bot once per head and watch for its result. Held replies return to the user for "post". If a configured bot cannot review drafts, report that blocker to the user; changing draft status or dropping the reviewer needs their decision. Launch no child until the gate returns `ready`.

Readiness is an observation at this head, not a promise that no later finding will arrive. T3 uses one gate run per wake; no extra quiet interval or polling loop is required.

## Reuse before launching

Run `node "$SHIP" verdict check <n> $FLAGS --json`, with the invocation's unchanged repository and trust flags. Read the recorded verdict and its proof alongside the current issue, spec and contract.

- `current`: reuse the passing verdict, including across a restack that preserves its fingerprint. A fresh user request since that verdict, changed acceptance criteria, or a changed verification recipe or required service that invalidates its proof needs a new run. Name the concrete change; unrelated base movement and a same-commit CI retry alone do not invalidate proof.
- `missing`, `stale` or `failed`: a new run is needed. Fix outstanding findings and return through readiness first. The existing trust and strict patch-fingerprint rules decide whether a verdict is current; a matching title, tree or remembered result is insufficient.

Record `verification: reused | deferred | new` with the reason, published head, criteria source and evidence. For a new run, also record the child task, actual model and effort. A deferred gate is not a failed verifier or a completed verification.

## Bound each new brief

Give the child the PR, published SHA, acceptance criteria, relevant paths, verification recipe, existing captures and the safety assumption to prove. Ask for evidence and findings for the three lanes in `ship verify`, with commands, tested SHA and gaps. Existing captures help orient it; they do not replace running a required lane. Keep its work tied to those criteria and paths, expanding only for a dependency needed to prove them. Report unrelated findings to the parent for scope judgement.

## Repairs during a run

A new finding first needs a decision. Rejected findings, nits, a same-commit CI retry and a same-patch restack alone do not call for cancelling or replacing the verifier. Keep its checkout at the pinned head while it runs.

When an accepted repair will change the tested patch, cancel the invalidated child before editing its checkout. Save any useful commands, captures and partial findings with their tested SHA and validity limits. They are partial evidence, never a passing verdict. Batch the repairs, push, and return through readiness before launching a replacement. A verifier's own `FAIL` follows that same path. Record the cancellation or FAIL and its reason so the next brief can use the findings without repeating their discovery.

Record the final verdict only against the head the child actually tested. If the published head moved, follow the existing head check; never relabel an old run as having tested the new SHA.
