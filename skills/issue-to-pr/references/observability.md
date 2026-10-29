# Opt-in Langfuse pilot

Use the shared [pilot setup](../../../instrumentation/README.md) only when the user opted in. The run record remains authoritative for orchestration. Only its owning thread writes it.

The owning thread records `telemetry_workflow` and `telemetry_attempt` in the header after opt-in. Keep the workflow on resume; generate a fresh attempt with `node -e 'console.log(crypto.randomUUID())'`. Configure runtime capture with those same identities and invocation `issue-to-pr`. Hash the actual skill directory, including its scripts and references; the emitter computes that revision.

After saving each stage's record, write a metadata JSON file outside the repository and run:

```sh
node <issue-to-pr>/scripts/observe.mjs <record> <metadata.json>
```

Use `kind: skill.loaded` only for loading; `skill.started` for invocation; `stage` at each stage boundary; `waiting` with execution `waiting-human` or `waiting-external` before yielding; `interrupted` when the host reports interruption; `resumed` with execution `running` under the new attempt; `skill.finished` with the actual terminal execution state. Each marker needs a unique `eventKey` within its invocation/attempt/kind. Retry the same key for the same event. Missing host markers remain a capture gap, never inferred success.

At a gate, use `kind: gate` and references containing URI, SHA-256, current head, pass/fail result and expiry. The shared contract downgrades missing, stale or mismatched evidence to unknown. Expected test-first failures use `reason: expected-red`; recovered tool failures use `reason: recovered`. Neither establishes workflow failure. Use `reason: autonomous` versus `user-requested` on repair markers, following the existing repair ledger; telemetry never edits the budget. Terminal execution and outcome are independent.

Bind observable delegates to a child invocation with `parent`, `task` and their actual provider/model/effort. Set `childCoverage: partial` until every expected child has counters. A Skill tag or a file read alone establishes no token ownership; keep allocation ambiguous unless a runtime request has one supported owner. Never ask helpers to write this run record.

Check `cli.mjs status` after capture. Pending, exhausted, rejected, unavailable and missing-hook states are rollout gaps. Retry delivery with `cli.mjs flush`; collection failures never block the user's workflow. Workflow gates retain their own failure behavior.
