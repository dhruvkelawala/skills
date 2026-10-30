# Evidence

Prove behavior through the runnable command or API and retain a sanitized transcript. Unit tests alone do not establish live capture or backend persistence.

## Surfaces

| Surface | Path | Launch | Drive | Capture |
| --- | --- | --- | --- | --- |
| Metadata CLI and provider hook | `instrumentation/cli.mjs` | `node instrumentation/cli.mjs status` | CLI commands and generated project hooks | JSON status, exact command and sanitized result |
| Langfuse ingestion, reads and predicates | `instrumentation/pilot/` | [isolated startup](instrumentation/pilot/README.md) | repository probes through real HTTP APIs | sanitized seed/read/replay/outage JSON and webhook receipts |
| issue-to-pr workflow | `skills/issue-to-pr/` | owning T3 build thread with opt-in config | existing pipeline and `scripts/observe.mjs` | real lifecycle markers, run-record owner/head and backend readback |
| Outside research workflow | installed research skill | T3 research child with project hook | installed skill and `instrumentation/external.mjs` | artifact hash, source references, actual revision and live readback |
| Existing skill scripts | `skills/*/scripts`, `scripts` | documented Node command | each script's CLI | trimmed terminal transcript when behavior changes |

## Capture

Follow `instrumentation/pilot/README.md` from the repository root. Keep credentials, outbox contents, provider transcripts and unfiltered backend responses outside the repository with private permissions. Capture the current commit and tree alongside every result. `probe.mjs` prints only synthetic metadata and selected readback. `alerts.py read` prints only matching pilot receipts. Review references and identifiers before publishing.

For each criterion capture its public behavior: workflow identities/revisions, independently worked usage totals, rejected upload and fresh-process recovery, source and stored canary absence, wait/resume/evidence validity, outside research artifact/sources, actual alert receipts, and the live provider boundary. Record full verification separately.

Direct live T3 evidence requires an automatic hook from a fresh T3 session reaching Langfuse, its exact session identity and an independent source-counter comparison. Standalone hook invocation on a transcript is adapter replay. Manually supplied fixtures prove only backend behavior. A missing supported trust or launcher capability is an explicit rollout blocker, with a sanitized configuration/inventory capture and the criterion left incomplete. No capture exemption turns a blocked live path into success.

For existing skills, record the command and its exact observable output before and after the change. Do not run live evaluation batches unless they are separately authorized. Tests that use fake external executables do not invoke models.

## Publish

Publish sanitized captures using the evidence skill's orphan-branch helper:

```sh
<skills-dir>/evidence/scripts/publish-evidence.sh --repo dhruvkelawala/skills --label 148 <capture-files>
```

Use the returned GitHub links in the PR with the captured HEAD. Text reports and reproducible synthetic fixtures can live in `instrumentation/pilot/evidence/`; private raw captures stay outside Git.

## Exemptions

None for this pilot. A required live capture that cannot run is recorded as incomplete with its exact blocker.

## Per-change checklist

1. Launch the changed command/API at the current HEAD.
2. Drive each criterion and capture the behavior, including rejection and recovery paths.
3. Inspect exports and stored fields for canaries and credentials.
4. Publish the sanitized captures and link each criterion and HEAD.
5. Stop isolated services and remove only hash-matched generated hooks.
