# Opt-in Langfuse pilot

Use the shared [pilot setup](../../../instrumentation/README.md) only when the user opted in. The run record remains authoritative for orchestration. Only its owning thread writes it.

`scripts/watch.mjs` captures runs without the agent's help. A scheduled job on the machine runs it every few minutes. It reads only records at `<repo>/<issue>.md`, and gives a record without `telemetry_attempt` an attempt of its own. It sends a marker when a record's `stage` or `head` changes, and the token usage of every Claude or Codex session whose branch and working directory match the record's `branch` and `repo`. A helper takes ownership explicitly by naming exactly one known run with `issue-to-pr-run: <telemetry_workflow>` in its first user message. This first-task marker takes priority over branch matches. Ambiguous or unknown first-task markers exclude the session. Without a marker, a session matching several runs' branches remains ambiguous; later mentions establish no ownership. Each pass retries undelivered events and reports `pending` and `exhausted` counts in its output. The steps below add markers the watcher cannot see, such as gates, repairs and waits.

The owning thread records `telemetry_workflow` and `telemetry_attempt` in the header after opt-in. Keep the workflow on resume; generate a fresh attempt with `node -e 'console.log(crypto.randomUUID())'`. Configure runtime capture with those same identities and invocation `issue-to-pr`. Hash the actual skill directory, including its scripts and references; the emitter computes that revision.

After saving each stage's record, write a metadata JSON file outside the repository and run:

```sh
node <issue-to-pr>/scripts/observe.mjs <record> <metadata.json>
```

Each call also records the owning session's token usage. It reads that session's own transcript, found from `CLAUDE_CODE_SESSION_ID` or `CODEX_THREAD_ID`, so no hook setup or session binding is needed. The `usage` field in the output reports it. The watcher captures registered helpers too. `childCoverage` is computed from the declared helper inventory and captured counters; it is `partial` while a declared helper is missing and `unknown` without an inventory.

Use `kind: skill.loaded` only for loading; `skill.started` for invocation; `stage` at each stage boundary; `waiting` with execution `waiting-human` or `waiting-external` before yielding; `interrupted` when the host reports interruption; `resumed` with execution `running` under the new attempt, except after the stage 5 context reset, where the run never stopped: there it keeps the record's attempt and carries `reason: context-reset`; `skill.finished` with the actual terminal execution state. Each marker needs a unique `eventKey` within its invocation/attempt/kind. Retry the same key for the same event. Missing host markers remain a capture gap, never inferred success.

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

Put these lines in the first task message, before the brief. Codex transcripts can start with the host's `# AGENTS.md instructions` message containing `<environment_context>`; the parser skips that setup message and any markers inside it. The first task message after it owns attribution. Each helper message names one run. The command uses the record's workflow, or the same stable fallback as the watcher for older records. It works without an enabled upload configuration. Source reviewers use `reviewer`, ship's independent child uses `verifier`, and council members use `council` in every round. Native agent-tool children also receive these lines when launched explicitly. Register a replacement with a fresh ID; missing usage from a cancelled attempt remains a capture gap.

Only the owning thread changes the inventory. An explicitly empty `telemetry_helpers: []` means no helpers are expected. The watcher records a helper receipt only after its requests and counters were accepted by the outbox. `observe.mjs` uses those receipts for markers and owner usage, so callers cannot declare coverage complete themselves. Delivery failures remain visible in outbox status.

## Ephemeral autoreview usage

For each autoreview availability attempt, register role `autoreview` and a fresh ID, and pass `--status-output <record-without-md>.autoreview-<helper-id>.json`. For example, `173.md` with helper ID `opinion-1` uses `173.autoreview-opinion-1.json` beside the record. Keep these files private. The patched pinned autoreview records usage for both engines in JSON and streaming modes, including failed or unknown attempts. Its counters distinguish Claude input and cache tokens from Codex input that already includes cache reads.

The watcher consumes registered sidecars and uses a stable request identity for each run/helper ID. Re-reading the file updates that request rather than creating another one. It tags the request `helper: autoreview`; only complete measured attempts complete the helper's coverage receipt. Missing sidecars, unknown counters and partial attempts remain gaps. No transcript or review prose is exported.

## Attribution replay

`node <issue-to-pr>/scripts/replay-attribution.mjs <record-root> <private-manifest.json>` reads records and transcripts and prints sanitized ownership and usage. A manifest is an array of `{runtime, path, original?}` entries. It compares the original branch rule with current attribution, using `original` when testing an annotated private copy. It never writes to the outbox or sends events. Session identities are hashed in its output.

Historical briefs predate run markers. To test what the new helper launch instructions would have captured, independently identify those helpers from their actual briefs and the owning run record, then add the new lines only to private copies of their first task messages. Leave controls and source files untouched. Report this as an annotated replay; unmodified historical helpers without markers remain unmatched. Keep original hashes and the private manifest beside the run's evidence.

## Context reset rollout

After 10 runs that reset their context at stage 5, compare them with the 1 to 11 November 2026 baseline of runs without it: the context size of each watch wake and the handoff, the cost per run from the captured usage, and the repair outcomes. The `context-reset` markers and each run's `first request after the reset` line find the runs; the user makes the comparison. Roll the reset back, by reverting its stage 5 step, when a repair made after a reset causes an accepted P0 or P1.
