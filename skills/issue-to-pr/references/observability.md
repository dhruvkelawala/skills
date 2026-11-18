# Opt-in Langfuse pilot

Use the shared [pilot setup](../../../instrumentation/README.md) only when the user opted in. The run record remains authoritative for orchestration. Only its owning thread writes it.

`scripts/watch.mjs` captures runs without the agent's help. A scheduled job on the machine runs it every few minutes. It reads only records at `<repo>/<issue>.md`, and gives a record without `telemetry_attempt` an attempt of its own. It sends a marker when a record's `stage` or `head` changes, and the token usage of every Claude or Codex session whose branch and working directory match the record's `branch` and `repo`. When no branch matches, a helper can instead name exactly one known run with `issue-to-pr-run: <telemetry_workflow>` in its first user message. Later mentions and ambiguous markers are ignored. A session matching several runs' branches remains ambiguous. Each pass retries undelivered events and reports `pending` and `exhausted` counts in its output. The steps below add markers the watcher cannot see, such as gates, repairs and waits.

The owning thread records `telemetry_workflow` and `telemetry_attempt` in the header after opt-in. Keep the workflow on resume; generate a fresh attempt with `node -e 'console.log(crypto.randomUUID())'`. Configure runtime capture with those same identities and invocation `issue-to-pr`. Hash the actual skill directory, including its scripts and references; the emitter computes that revision.

After saving each stage's record, write a metadata JSON file outside the repository and run:

```sh
node <issue-to-pr>/scripts/observe.mjs <record> <metadata.json>
```

Each call also records the owning session's token usage. It reads that session's own transcript, found from `CLAUDE_CODE_SESSION_ID` or `CODEX_THREAD_ID`, so no hook setup or session binding is needed. The `usage` field in the output reports it. The watcher captures registered helpers too. `childCoverage` is computed from the declared helper inventory and captured counters; it is `partial` while a declared helper is missing and `unknown` without an inventory.

Use `kind: skill.loaded` only for loading; `skill.started` for invocation; `stage` at each stage boundary; `waiting` with execution `waiting-human` or `waiting-external` before yielding; `interrupted` when the host reports interruption; `resumed` with execution `running` under the new attempt; `skill.finished` with the actual terminal execution state. Each marker needs a unique `eventKey` within its invocation/attempt/kind. Retry the same key for the same event. Missing host markers remain a capture gap, never inferred success.

At a gate, use `kind: gate` and references containing URI, SHA-256, current head, pass/fail result and expiry. The shared contract downgrades missing, stale or mismatched evidence to unknown. Expected test-first failures use `reason: expected-red`; recovered tool failures use `reason: recovered`. Neither establishes workflow failure. Use `reason: autonomous` versus `user-requested` on repair markers, following the existing repair ledger; telemetry never edits the budget. Terminal execution and outcome are independent.

Keep each helper's actual provider/model/effort on its request events. Register expected helpers as described below; a session with no counters does not complete coverage. A Skill tag or a file read alone establishes no token ownership; keep allocation ambiguous unless a runtime request has one supported owner. Never ask helpers to write this run record.

Check `cli.mjs status` after capture. Pending, exhausted, rejected, unavailable and missing-hook states are rollout gaps. Retry delivery with `cli.mjs flush`; collection failures never block the user's workflow. Workflow gates retain their own failure behavior.


## Helper attribution

The owning thread registers each helper before launch:

```sh
node <issue-to-pr>/scripts/helper-brief.mjs <record> <role> <helper-id>
```

Choose a stable ID for this launch, such as `pass1-standards`, `verify-2` or `council-r2-sol`. The command appends it to the record's `telemetry_helpers` JSON array and prints:

```text
issue-to-pr-run: <telemetry_workflow>
issue-to-pr-helper: <reviewer|verifier|council|autoreview>
issue-to-pr-helper-id: <helper-id>
```

Put these lines in the first task message, before the brief. Each helper message names one run. The command uses the record's workflow, or the same stable fallback as the watcher for older records. It works without an enabled upload configuration. Source reviewers use `reviewer`, ship's independent child uses `verifier`, and council members use `council` in every round. Native agent-tool children also receive these lines when launched explicitly. Register a replacement with a fresh ID; missing usage from a cancelled attempt remains a capture gap.

Only the owning thread changes the inventory. An explicitly empty `telemetry_helpers: []` means no helpers are expected. The watcher records a helper receipt only after its requests and counters were accepted by the outbox. `observe.mjs` uses those receipts for markers and owner usage, so callers cannot declare coverage complete themselves. Delivery failures remain visible in outbox status.
