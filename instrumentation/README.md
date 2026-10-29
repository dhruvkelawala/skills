# Controlled Langfuse skill pilot

This opt-in integration exports workflow markers and runtime usage to Langfuse OSS. It adds no model calls, grades or execution limits. The pilot is incomplete until direct live T3 capture and interruption/resumption evidence pass for both providers. See [the rollout report](pilot/report.md) for the current gates.

## Setup

Use Node 22 or later. Collection is disabled unless `SKILL_OBSERVABILITY_CONFIG` points at a private mode-0600 JSON file with `enabled: true`. Keep that file and the mode-0700 outbox outside the repository. Copy this shape, replacing placeholders privately:

```json
{
  "enabled": true,
  "directory": "/absolute/private/outbox",
  "endpoint": "http://127.0.0.1:3307",
  "publicKey": "<local project public key>",
  "secretKey": "<local project secret key>",
  "since": "<opt-in timestamp in ISO 8601>",
  "skillDirectory": "/absolute/installed/skill",
  "context": {
    "workflow": "<stable UUID>",
    "attempt": "<new UUID on resume>",
    "invocation": "<skill invocation UUID>",
    "parent": null,
    "skill": "research",
    "provider": null,
    "model": null,
    "effort": null,
    "session": null,
    "task": null,
    "repository": null,
    "head": null,
    "allocation": "ambiguous",
    "childCoverage": "partial"
  }
}
```

Use the runtime's actual provider/model/effort when exposed. Null remains unknown. Bind `context.session` to the exact intended runtime session before enabling hook capture. Unbound or different sessions return unavailable before reading a transcript; other tasks in the project cannot inherit this invocation's identity. Use a separate configuration for each invocation and child, with distinct workflow/attempt/invocation values as appropriate. A launcher that cannot expose or bind the session is a live-capture blocker; workflow markers remain usable. `since` bounds export to this opt-in, although cumulative accounting may read earlier counters to establish a baseline. The hook reads only the exact supplied session file, with a 64 MiB limit. It recognizes the pinned Codex cumulative `token_count` and Claude assistant usage records; it does not parse conversational content or search historical sessions. Unsupported records, counter resets, unobserved API failures and missing children are coverage gaps. Treat the observed request count as a subtotal of provider billing.

Start an isolated Langfuse deployment using the [trial commands](pilot/README.md), or supply your own OSS endpoint. In a new project hook process, the command below writes only a project-local hook file. It refuses an existing file rather than changing someone else's hooks:

```sh
node instrumentation/pilot/setup.mjs create claude <project-directory> <private-config.json>
node instrumentation/pilot/setup.mjs create codex <project-directory> <private-config.json>
```

Choose the runtime you will use. Inspect the resulting exact command. Claude uses `.claude/settings.local.json`; Codex uses `.codex/hooks.json`. The generated project files have no credentials. Start a fresh T3 delegate/session in the prepared project so it can load those hooks. A standalone CLI capture is a replay or CLI probe, not proof of live T3 capture.

Codex requires exact-definition hook trust through the supported `/hooks` flow in the same worktree and CODEX_HOME/profile as T3. [Official hook documentation](https://learn.chatgpt.com/docs/hooks) says changed definitions require fresh review. A trusted project alone does not trust its hooks. Confirm `hooks/list` reports the intended commands enabled and trusted before a fresh Sol probe. The inspected app-server supports listing but no trust mutation; T3 delegate options expose no per-launch telemetry override. If that supported human review path is unavailable, leave the live Codex criterion incomplete. Preserve trust records and global provider configuration.

## Workflow markers and research

Use `cli.mjs event <metadata.json>` for `skill.loaded`, `skill.started`, stage, wait/resume/interruption, gate, repair and finish events. Each event needs a stable `eventKey`; replay the same key only for the same fact. Set execution separately from outcome. A skill file load, an invocation and completion are different events. Actual skill revisions hash the regular files in the skill directory, including installed modifications; `.git`, dependencies installed in `node_modules`, Python bytecode and `.env` files are excluded. Add any runtime-relevant dependency revision separately before extending this pilot beyond those directories.

Issue-to-pr's owning thread follows [its marker instructions](../skills/issue-to-pr/references/observability.md). This changes no single-writer, review, repair-budget, evidence or merge policy.

For an external skill, call `node instrumentation/external.mjs <marker.json>` around the installed workflow. A marker has `phase: load|start|finish`, `eventKey`, `skillDirectory` and the current `head`. A finish marker can include `artifact` as a local file, `artifactUri` as an HTTPS publication link, and `sources` as evidence references. The wrapper hashes the actual installed skill and artifact; it sends no contents. Research stays installed through `outside-skills.json`; this repo contains no copy of its source. Run the installed research skill in a T3 child and record the child's exposed task/parent IDs. An unassessed claim remains unknown.

Evidence references require `uri`, `sha256`, `head`, `result: pass|fail|unknown` and `expires`. Gate outcomes require fresh evidence for the same head, and pass/fail must match the supplied check result. Record the judge and rubric version for assessed results. These are evidence assertions from the existing gate or operator, not autonomous quality judgments. Expired evidence becomes unknown when reporting the current outcome. Missing lifecycle markers and host interruptions need explicit reconciliation.

## Accounting, delivery and privacy

Provider requests have stable source identities across retries and resume. Claude streaming rows merge by message ID; Codex cumulative counters become deltas and repeated snapshots are ignored. Cache reads and reasoning remain subsets where the runtime defines them that way. Inclusive totals use unique descendant requests. Exclusive ownership remains null for ambiguous allocation; child coverage remains explicit. Measured totals are known subtotals when failed requests expose no usage; `unknownUsage` and child coverage qualify them. No price table is configured. Token counters are measured; backend calculated costs, if present, are estimates at the backend's model price basis, not subscription charges.

The source allowlist exports only contract identity, enums, hashes, counters, artifact/source references and gate metadata. Prompts, source text, command arguments, tool results and error bodies never enter the persistent outbox or network payload. There is no content-capture option in this pilot. References are intentional metadata and must be safe to share; credentials, query strings and URL fragments are rejected. Keep raw transcripts private.

Accepted events are atomically written and fsynced before upload. The outbox holds at most 1,000 pending/exhausted events and 16 MiB of total records by default. Hook requests retain acknowledged metadata within that byte bound: unchanged requests skip upload, late usage updates keep the first captured attempt/parent/revision, and new requests can advance on later hooks after a full batch flushes. `remembered` reports acknowledged records. Other emitter calls remain explicit replay. Failed uploads retry with exponential backoff up to eight attempts when `cli.mjs flush` runs, including after restart. The hook also flushes automatically. Rejected OTLP spans and failed score uploads retain the same IDs. Exhausted entries and acknowledged metadata count against the byte bound; inspect status and preserve evidence before manually archiving a completed invocation's outbox. A full metadata history returns unavailable rather than silently forgetting progress. No hidden daemon or scheduler is installed.

```sh
SKILL_OBSERVABILITY_CONFIG=<private-config.json> node instrumentation/cli.mjs status
SKILL_OBSERVABILITY_CONFIG=<private-config.json> node instrumentation/cli.mjs flush
```

Always inspect the structured result. `disabled`, `busy`, `unavailable`, pending, rejected or exhausted is not successful capture. Hook commands exit zero so telemetry cannot fail the originating task; this does not make capture complete. A missing final hook cannot guarantee delivery of events never accepted by the outbox. [Queries and warnings](queries.md) pair backend views with local status.

For an execution-time report, pass an array of contract events to `summarize` from `instrumentation/workflow.mjs`, with the current artifact `head`. It returns active/waiting milliseconds, execution, current evidence-backed outcome and repair counts. For example, from this repository root:

```sh
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {summarize} from "./instrumentation/workflow.mjs"; console.log(JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[1])), {head:process.argv[2]})))' <metadata-events.json> <current-head>
```

## Disable and clean up

Set `enabled: false` or unset the config variable. Remove only unchanged generated hooks with `setup.mjs remove <runtime> <project> <private-config.json>`. Remove private outbox/config files only after preserving needed evidence. Stop trial services as the [trial README](pilot/README.md) directs. Retain volumes unless their deletion is explicitly wanted. No global provider configuration or existing service needs changing.
