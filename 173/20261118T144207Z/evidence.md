# Helper telemetry evidence for issue 173

Captured at head `e1eacc9b83595c2b6af3b89ab23a1546b63b8b27`, tree `2e509c879da9d65698542078971450605cca644b`, against base `5baec097de51ebff2d5a28388200185c1b4dbd81`.

The changed CLI and watcher ran against Langfuse 4.72.0 through its real ingestion and public read APIs. Fresh reviewer transcripts supplied real counters, and the isolated reviewers supplied real off-branch ownership cases. Capture used a private home containing only this run's record, four unmodified reviewer transcripts and the ephemeral Claude status. This is manual adapter capture of real sessions. It does not establish that a newly installed automatic T3 hook ran. No provider or global skill configuration changed.

## 1. Explicit ownership works across branches

The two pass-2 reviewers ran on `review/issue-173-repairs` and `review/issue-173-repairs-1`. Their first task messages contained the registered run, reviewer role and helper ID. Neither branch matches the owning run's branch. The watcher attributed both to the run, and Langfuse stored their requests as `helper: reviewer`. The two pass-1 reviewers still belong to their existing owner.

A separate synthetic CLI replay checked the priority and rejection rules:

```text
case                   branch-only owner  current owner
marked-other-branch    fixture-run-2     fixture-run-1
two-runs               fixture-run-2     none
unknown-on-branch      fixture-run-2     none
late                   none              none
unmarked-control       fixture-run-2     fixture-run-2
```

Command from the repository root:

```sh
node skills/issue-to-pr/scripts/replay-attribution.mjs \
  <private-fixture-record-root> <private-fixture-manifest.json>
```

The real session ownership results are in `live-capture-result.json`; the synthetic cases are in `ownership-cases.json`. The fixture's intentional owner change exercises criterion 1. The unrelated historical controls in criterion 6 change no owner.

## 2. Registered helpers complete measured coverage

Each workflow points to the same registration command before launch: issue-to-pr source reviews and the extra opinion, ship's isolated verifier, and council members in every round. The private fixture CLI produced these exact marker blocks:

```text
$ node skills/issue-to-pr/scripts/helper-brief.mjs <record> reviewer source-review
issue-to-pr-run: fixture-helper-briefs
issue-to-pr-helper: reviewer
issue-to-pr-helper-id: source-review

$ node skills/issue-to-pr/scripts/helper-brief.mjs <record> verifier ship-verify
issue-to-pr-run: fixture-helper-briefs
issue-to-pr-helper: verifier
issue-to-pr-helper-id: ship-verify

$ node skills/issue-to-pr/scripts/helper-brief.mjs <record> council council-r2
issue-to-pr-run: fixture-helper-briefs
issue-to-pr-helper: council
issue-to-pr-helper-id: council-r2
```

The real run declared five helpers: four reviewers and one autoreview. Before capture, coverage was `partial`. After accepted usage for all five, it was `complete`. A subsequent `observe` marker reached Langfuse with the computed coverage. This fixture deliberately supplied no owning session to `observe`, so its separate owner-usage field is `unavailable`; no owner-capture success is claimed.

```text
first watch:    4 transcripts, 52 requests, 0 unavailable, 0 pending, 0 exhausted
repeated watch: 0 transcripts,  0 requests, 0 unavailable, 0 pending, 0 exhausted
coverage:      partial -> complete
```

The command driver used the public `watch(config, privateHome)` interface with `configuration()` and then `observe(record, marker, config, {})`. It preserved this run's identities and expected inventory. Raw transcripts, outboxes and credentials remain private.

`complete` means every expected helper has attributed measured counters. It does not establish that every helper process has exited. Later counters still update the stable request. Tests also prove that incomplete autoreview attempts keep coverage partial and malformed inventory registration leaves the original file unchanged.

## 3. Both autoreview engines reach the outbox once

The extra opinion used the pinned autoreview with the repository's manifest patch installed into a private directory. Its real status reported one complete Claude attempt, a model list containing `claude-opus-5-5`, and 45,830 tokens: 2 input, 6,104 output and 39,724 cache creation. Langfuse stored one autoreview request with the model name and the same measured total. Repeating the watcher created no request.

```sh
python3 <private-patched-autoreview> --mode branch \
  --base 5baec097de51ebff2d5a28388200185c1b4dbd81 \
  --engine claude --model claude-opus-5-5 --max-priority P1 \
  --status-output <private-record>.autoreview-opinion-1.json \
  --output <private-report.txt> --json-output <private-report.json> \
  --stream-engine-output
```

For Codex, a synthetic `turn.completed` event went through the real pinned `record_codex_usage` and `write_review_status`, then the real watcher and backend. Its 100 input tokens include 30 cached tokens; 20 output tokens include 5 reasoning tokens. Readback has one request and 120 total tokens, labelled `autoreview`, model `gpt-6.1-sol`. This Codex case invoked no model. Both JSON and streaming forms passed the Python status contract check.

Global autoreview installations still need the normal skills sync to acquire the manifest patch. This run changed no global installation. The installer test proves patched-first-install, idempotent repeat and byte-preserved agent folders when a patch fails. Attempts involving several models retain unknown model pricing.

## 4. A transcript above 64 MB reaches the backend

The synthetic JSONL source contains 68,167,509 bytes. A usage event at its tail reports 123 input and 17 output tokens. Both commands used a 48 MB Node heap and a private configuration loaded from disk:

```text
$ node --max-old-space-size=48 <base>/instrumentation/cli.mjs hook codex < <payload.json>
{"status":"unavailable"}

$ node --max-old-space-size=48 instrumentation/cli.mjs hook codex < <payload.json>
{"status":"captured","accepted":1,"delivery":{"status":"flushed","delivered":1,"pending":0,"exhausted":0,"remembered":1,"rejected":0},"coverage":"unknown","measured":true}
```

The payload contains only the fixture's session ID and private transcript path. Langfuse readback reports one request and 140 tokens. The source includes a content canary. Neither the stored observations nor scores contain it, and stored input and output are absent. See `large-transcript.json` and `backend-sanitized.json`.

## 5. Request roles and the documented cost query work

All 52 selected real requests retain their role and model. Independent source counts match the backend's stable runtime-token scores:

| Helper | Requests | Source tokens | Stored tokens |
| --- | ---: | ---: | ---: |
| Pass 1 standards | 9 | 713,422 | 713,422 |
| Pass 1 spec | 8 | 585,554 | 585,554 |
| Pass 2 standards | 6 | 412,878 | 412,878 |
| Pass 2 spec | 28 | 2,301,009 | 2,301,009 |
| Autoreview | 1 | 45,830 | 45,830 |
| Total | 52 | 4,058,693 | 4,058,693 |

The independent calculation reads the raw provider counters by message identity, without importing the accounting code. Backend readback paginates observations and scores, deduplicates IDs and matches the deterministic per-request score IDs. Every selected observation has absent input and output. See `source-counters.json` and `backend-sanitized.json`.

The exact jq program from `instrumentation/queries.md` ran over all saved observation pages. It grouped 51 reviewer requests and one autoreview request with backend prices. Its `unknown` group contains 78 earlier events emitted before the new role metadata, which this change does not relabel. The synthetic large-file request separately proves the default `build` role. Missing model prices remain null. See `cost-by-helper.json`.

## 6. Historical replay adds only the nine selected helpers

```sh
node skills/issue-to-pr/scripts/replay-attribution.mjs \
  <private-record-root> <private-replay-manifest.json>
```

```json
{"mode":"dry-run","sessions":435,"newlyAttributed":9,"changedOwner":0}
```

Five independently identified PR 997 verifier sessions and four `council/962-r2` sessions gain visaroy 962 ownership. The verifier group has 62,526,882 tokens and council round two has 4,223,710. All 426 controls retain their owner, including two PR 1005 verifiers that merely mention 962.

The original historical briefs have no markers. Only private copies of the nine first task messages received the new markers. This annotated replay demonstrates what the new launch instructions would capture; it cannot retroactively attribute unmodified historical helpers. Original file hashes remain in `historical-replay.json`, along with hashed session IDs. Original transcripts remain unchanged. The replay performed no outbox writes or network sends.

## Verification and limits

At the captured head, `node --test` passed 371 tests in four suites, with no failures. Both directly executable cleanup Python checks and the patched autoreview status contract passed. `git diff --check` passed. The repository defines no separate lint, typecheck, build or CI command.

Both independent source-review passes completed on Claude Opus 5.5. Review and live capture prompted two P1 repairs: explicit ownership priority and the real status model shape. Pass 2 independently checked both; its spec reviewer reran all 371 tests and older-source red checks. The extra opinion completed at de9f284 with no P0/P1 findings, using the frozen diff without access to unchanged repository files. It did not re-review the later e1eacc9 repair; both source axes did.

Remaining follow-ups are CLI documentation of accepting `build`, malformed-header error presentation and a possible named helper for the inline model selection. Coverage measures attribution rather than process termination. This evidence does not claim automatic fresh-T3-hook capture, a global skills rollout, live Codex model usage, or historical backfill.
