# Independent ship verification: PR 149 (issue 148)

- **Verdict:** PASS+NOTES (AC8 stays INCOMPLETE, as the filed contract allows; no AC bug found)
- **Tested:** HEAD `9e3bd8337bc17f42131e183987ce4fe4124438a6`, tree `15e7c4f47a2149f7be358fd98f4cb1b13f758488`, base `066cd0510ad79c390f2ef5837deecef22dd96599`. The local worktree was clean and matched the published PR head before and after the run.
- **Verifier:** claude-opus-5-5 (Claude Code), launched by the parent at effort high. No fallback. No child agents. No paid model calls.
- **Window:** 2026-10-29 21:37:15Z start (VM start) to 21:49Z (VM stopped).
- **Criteria source:** issue #148 and the `## Contract` section of `~/.agent/issue-to-pr/skills/148.md`.
- **Recipe:** `EVIDENCE.md`, `instrumentation/README.md` and `instrumentation/pilot/README.md`.
- **Base comparison:** not applicable. The base has no instrumentation, so expectations are independent literal totals.

## Lane 1: Gates (verify skill, full mode)

Discovery found no CI, no `package.json`/Makefile/pyproject, and no AGENTS/CLAUDE/CONTRIBUTING commands. That leaves the test runners, which I discovered from `git ls-files`. The list is in `discovered-tests.txt`.

| Command | Result |
| --- | --- |
| `CI=1 node --test <30 *.test.mjs files>` (Node v26.13.0) | passed: 339 tests, 339 pass, 0 fail (`gates-node.txt`) |
| `python3 skills/cleanup/scripts/test-worktree-audit.py` | passed (`gates-test-worktree-audit.txt`) |
| `python3 skills/cleanup/scripts/test-artifact-audit.py` | passed (`gates-test-artifact-audit.txt`) |
| `node --check` on 18 changed `.mjs` files; `ast.parse` on `alerts.py` and `backend.py` | passed (`gates-syntax.txt`) |

**Result:** green. The suite covers accounting, evidence validity, hook recovery/progression/privacy, lifecycle and the installed-symlink observe CLI (`observe.test.mjs`).

## Lane 2: Live (isolated Langfuse 4.72 trial on the dedicated colima `bakeoff` socket)

Every seed used a fresh private registry or outbox under `live/`. I wrote nothing to existing registries or owner outboxes. Driver: `drive.mjs` (imports the worktree modules and runs the real CLIs). Reads poll asynchronously, and every failed early attempt is kept as a failure in `readAttempts`.

**Classification:** every hook result below is a CLI hook **adapter replay over synthetic transcripts**, or a backend fixture. None of it is live T3 capture.

### Repository recipe (`SKILL_PILOT_STATE=live/probe-state`)
1. `probe.mjs seed` delivered 3. `read` returned: 3 unique observations; `v2/metrics` sum 240, count 1; usageDetails input 150, output 30, cache_read 50, reasoning 10; 1 evidence-failure score; stored canary absent.
2. `SKILL_TOKEN_WARNING=100 alerts.py configure` created two real monitors. `alerts.py read` showed token **ALERT 240 > 100** and evidence **ALERT 1 > 0**, one receipt each. Each receipt carries the workflow in the monitor name, the trace ID in the filters, the metric value, the operator and threshold, and a data permalink.
3. `probe.mjs replay` delivered 3. The read stayed at 240/1.
4. **Outage:** `backend.py stop langfuse-web langfuse-worker` (web returned HTTP 000).
   - `probe.mjs replay` left pending 3.
   - The CLI `event` returned in 65 ms with exit 0, accepted and pending 1.
   - Fresh processes reported pending 3 (`probe.mjs status`) and pending 1 (`cli.mjs status`).
   - After `backend.py up -d langfuse-web langfuse-worker`, `probe.mjs flush` delivered 3 and `cli.mjs flush` delivered 1, with 0 exhausted or rejected.
   - Outage readback: the first attempt failed (not yet ingested); the second, 5 s later, passed.
5. Settled re-read: 9 raw list rows (3 versions per ID), 3 unique, metrics still **240/1**. Replay and recovery did not inflate the authoritative totals.
6. Final `alerts.py read` after replay and outage: still **exactly one ALERT per rule**.

### Rejection, exhaustion and recovery (`live/rejection`)
- A wrong key returned **HTTP 401** from OTLP. With the bad key, `flush` gave delivered 0, pending 1.
- With `maxAttempts:2`, a second outbox reported **exhausted 1**.
- A fresh process reported pending 1 and exhausted 1. Authenticated recovery delivered 1, and backend readback found the event. No canary in the outbox or storage.

### Accounting and privacy through the real `cli.mjs hook` (`live/hook`)
**Setup:**
- Workflow with root invocation `root` (claude transcript, session S1) and child `child` (parent `root`, codex transcript, session S2, task `verifier-delegated-task`).
- Canaries placed in the prompt, source text, tool_use command arguments, tool_result, `toolUseResult.stderr`, API error body, codex `function_call` arguments and output, error event, and instructions.

**Independent literals:**

| Request | Calculation | Tokens |
| --- | --- | --- |
| A (streamed twice) | 10 + 7 + 100 + 20 | 137 |
| B (final, after a late cumulative update) | 5 + 6 + 50 | 61 |
| C (new request on resume) | 1 + 1 | 2 |
| One API failure | no usage | none |
| Codex cumulative deltas | 110 + 170 (repeated snapshot ignored) | 280 |
| **Total** | 5 scored, 6 requests | **480** |

**Results:**
- The wrong session returned `unavailable` before any read.
- First hooks accepted 3 and 2. Duplicate hooks accepted 3 and 2 but **delivered 0**. The resumed attempt with the late B update plus C **delivered 2**.
- Source outboxes (17.5 KB and 10 KB): canary absent.
- Readback (`50-hook-read.json`):
  - metrics **480 / 5**.
  - `totals(raw rows,'root')`: requests 6, failedRequests 1, unknownUsage 1, inclusive total 480, exclusive `null` (ambiguous), childCoverage `partial`, cost `null`. Child-only total 280.
  - usageDetails A: input 10, output 7, cache_read 100, cache_write_5m 20, cache_write_1h 0. Codex: cache and reasoning split.
  - Remembered requests A and B keep attempt `first`; C has `second`. The failed request is level ERROR.
  - The child carries provider openai, model gpt-6.1-sol, effort xhigh, turn-1, task, parent root.
  - The root provider is absent (unknown).
  - Kinds skill.loaded, skill.started, skill.finished and request are distinct. skill.started parents: child→root, root→null.
  - Schema `skill-run/v1`; eventIds unique.
  - All stored metadata keys are on the allowlist, plus the pilot's own 9 control attributes. 0 observations have input or output. **Stored canary absent.**
  - The root revision `52a01708…` and the child revision `32ddfa6a…` both equal my independent Python reimplementation (`revision.py`).
- The first hook-read attempt failed honestly. The list API returned two versions of msg-B under one ID, and my driver's last-wins dedupe kept the stale one. Diagnostic: `51-hook-msgB-diagnostic.json`. Authoritative metrics were already 480/5. The driver now keeps the latest `metadata.time` (see note N2).

### issue-to-pr lifecycle through the installed-symlink owner CLI (`live/lifecycle`)
**Command:** `node <tmp>/installed-issue-to-pr/scripts/observe.mjs <synthetic-owner-record> <marker>`, 14 calls. Between calls I acted as owner and rewrote only the synthetic record's `stage` and `telemetry_attempt`.

**Calls:** every call returned exit 0, accepted, delivered 1. The record's **bytes and mtime were unchanged across each call**.

**Readback (`50-lifecycle-read.json`):**
- 14 observations, all with the record's workflow and head. Marker input that tried to override workflow or head was ignored.
- Stages: build, watching, verify, done. Attempts: attempt-1, attempt-2. Revision matches the independent hash.
- Gates:
  - expected-red and recovered: level DEFAULT, no failure score.
  - unrecovered: the **only ERROR** observation.
  - Stale-head and missing-evidence "verified" gates were stored as **unknown**.
- Evidence-failure scores: value 1 (unrecovered) and value 0 (passing). Each comment carries judge `node-test`, rubric `verifier/v1`, and evidence head and result (`52-lifecycle-score-comments.json`, read with `fields=core,details`).
- `summarize`: activeMs 30000, **waitMs 60000**, execution completed, outcome verified, repairs autonomous 1 / requested 1. A wrong head gives **unknown**, and expired evidence gives **unknown**.

### External installed research (`live/research`)
**Command:** `node instrumentation/external.mjs <marker>` with `skillDirectory=~/.agents/skills/research`. The installed revision is `32ddfa6a…` (files `agents/openai.yaml` and `SKILL.md`; outside-skills ref `5beb35b…`).

**Calls:** load, start and finish each delivered 1. The finish marker named the in-repo `research/langfuse-pilot-capture-boundary.md` as the artifact.

**Readback:**
- The revision equals the independent hash. The artifact sha `991b5ad5…` equals `shasum`, and the artifact URI matches.
- Source reference: the official hooks page with sha `d83234…` and result unknown. A source with a `?token=` query was dropped.
- The finish marker requested `verified`, but the stored outcome is **unknown** because claim support was not assessed. Execution: completed.
- No `stage` or `repository` fields (no dependency on issue-to-pr fields). Canary absent.
- The installed research files' git blobs appear **0 times** in the repo tree, so research is not vendored.

### Configurable warning through actual predicates (`live/alerts-threshold-state`, a fresh registry on the hook workflow)
- `SKILL_TOKEN_WARNING=1000` → no receipts for 480 tokens. The helper's assertion fails, as expected for a negative case.
- `alerts.py update` with 400 on the same monitor IDs → **ALERT 480 > 400** within 15 s.
- The evidence rule stayed silent because this workflow has no failure.

### AC8 (live T3)
Not exercised: no supported exact-hook trust and no T3 prelaunch session binding. It remains **INCOMPLETE as filed**. I made no trust or provider change and used no bypass.

## Lane 3: Blast radius (`blast.mjs` → `blast-result.json`)
**Safety fact:** telemetry is opt-in and fail-open. Disabled or broken capture leaves originating work intact. Enabled capture serializes only allowlisted metadata, never writes the run record or policy, and touches only isolated services.

**Disabled telemetry:**
- Config unset, or `enabled:false`: `cli hook`, `event`, `status`, `external.mjs` and the installed-symlink `observe.mjs` all exit 0 with `disabled`. No outbox is created and 0 HTTP posts are made.

**Originating work:**
- Setup: a shell task (`echo before; <hook>; echo after; exit 7`) run under each config state: unset, mode 0644, malformed, dead loopback port, and remote plain-HTTP.
- In every state the task printed both lines, kept **exit 7**, and saw hook exit 0, in 28–77 ms.
- Dead port: pending 1 in a fresh process. Remote plain HTTP: `unavailable` with no network attempt. A live-PID lock gives `busy`, exit 0.

**Enabled capture (local receiver):**
- hook, event, external and observe each produced exports; 5 POSTs went to `/otel/v1/traces` and `/scores`.
- All 29 attribute keys are allowlisted, with no `.input` or `.output` attributes. Score keys are id, traceId, observationId, name, dataType, value and comment.
- **No canary and no fake secret** appear in any export body or outbox file. Outbox files are mode 600, the directory is 700, and no lock remains.

**Ownership and policy:**
- `observe.mjs` takes workflow, head and attempt from the record header, ignoring input overrides. Marker fields `repairs`, `merge` and `review_policy` are dropped.
- The owner record's bytes and mtime are unchanged.
- Of 45 base files under issue-to-pr, ship, pr-watch, apr and models.json, the only modification is `SKILL.md` (+4/−0 doc). Three files were added: `observability.md`, `observe.mjs` and its test.
- No other skill or script references the instrumentation.

**Generated hooks:**
- `setup.mjs create claude|codex` writes only project-local files, contains no credentials, sets the codex SessionEnd timeout to 3, and reports trusted `unassessed`.
- A second create is refused. `remove` refuses a modified hook and removes an unchanged one.
- No `.claude/settings.local.json` or `.codex/hooks.json` exists in the worktree. Scratch hook files were deleted.

**Services and configuration:**
- `backend.py` always sets `DOCKER_HOST` to the bakeoff socket. Published ports: web 127.0.0.1:3307 and minio 127.0.0.1:9097. Databases, redis and the receiver are unpublished.
- Global context and incumbents, before → after: colima-honcho → colima-honcho, 10 → 10, same IDs (`services-before.json`, `services-after.json`). The before list also matches the parent's `services-symlink-before.json`.

## Findings

No P0, P1 or P2 issues. No AC bug.

**Follow-ups (P3, for the parent's scope judgement):**
- **N1 (AC1/AC6 wrapper surface; same class as hosted P1 r4418065125):** `instrumentation/cli.mjs` and `instrumentation/external.mjs` still use the lexical entry guard `pathToFileURL(argv[1]).href === import.meta.url`. Run through a symlinked directory, they exit 0 and print nothing, so there is no status to inspect. Reproduce with `ln -s $PWD/instrumentation /tmp/x/instr; SKILL_OBSERVABILITY_CONFIG=<cfg> node /tmp/x/instr/cli.mjs status` (`live/61-symlink-entry-guards.txt`). The documented commands and generated hooks use real paths, so these are unaffected. A checkout under a symlinked path (for example macOS `/tmp`) would silently skip capture.
- **N2 (AC2 docs, `instrumentation/queries.md`):** "Deduplicate list rows by observation ID" doesn't say which version to keep. About 100 s after a late update, the v2 list still returned both versions of one ID. A naive last-wins dedupe showed stale usage (output 4 instead of 6). The authoritative score metrics and `totals()` over raw rows were correct. Suggest documenting "keep the latest `metadata.time`".
- **N3 (AC2 cost labelling):** Langfuse auto-computes `costDetails` for some generations from its own price table. Those stored fields carry no in-band estimate or price-basis label. The pilot's own totals report `cost: null`, and the README labels backend costs as estimates. This is documentation-level labelling only.
- **N4 (cosmetic):** `setup.mjs remove` leaves empty `.claude/` and `.codex/` directories. Two empty ones from 19:03 remain in the worktree; I left them untouched.

**Environment notes:**
- `colima start --activate=false` creates a `colima-bakeoff` Docker context without selecting it, and `colima stop` removed it again. Prior runs show the same behaviour.
- The probe readback stores the receiver's full `receipts.jsonl` (all trial workflows) privately at mode 0700.

**Known limits not re-reported:** the 16 MiB history bound, lock-contention tracking, and initially unknown metadata. PR-body deferred P2/P3 items are unchanged.

## Cleanup
- `python3 instrumentation/pilot/backend.py stop` stopped all 7 services. Volumes were kept, with no `down` and no `-v`.
- `COLIMA_HOME='/Volumes/SumoDeus NVMe/sob' colima stop --profile bakeoff` returned status Stopped, and the socket is gone.
- Docker context is still colima-honcho, and the context set is unchanged. The same 10 incumbent container IDs are running.
- The worktree is clean at the same HEAD. No generated hooks remain in the worktree or in scratch.
- I removed credentials from my 5 private probe configs and set them to `enabled:false`. A scan finds 0 files with the secret under this directory.
- The original `issue-config.json` is still `enabled:false`. I made no writes to the parent's registries, outboxes, owner record, trust, provider config, installed skills, GitHub or the run record.
