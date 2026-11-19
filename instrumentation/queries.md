# Pilot queries and warnings

Use the public `GET /api/public/v2/observations` endpoint with `traceId` and `fields=core,basic,usage,model,input,output,metadata`. Paginate until all observations are present. Deduplicate list rows by observation ID before inspecting the event tree. For authoritative measured tokens and request counts, use `GET /api/public/v2/metrics?query=<encoded JSON>` with the `usageQuery` exported by `queries.mjs`. The query sums numeric `runtime-tokens` scores with stable per-request IDs. Observation rows and ordinary observation aggregates can temporarily repeat usage during replay, so neither is authoritative for this pilot.

The observation metadata includes `workflow`, `attempt`, `invocation`, `parent`, `stage`, `execution`, `outcome`, `reason`, `revision` and evidence. Select rows by those fields through the backend's observation filters or inspect the public readback:

| Question | Selection |
| --- | --- |
| Workflow or stage failure | `execution = failed` or `reason = unrecovered`, grouped by workflow/stage |
| High usage | Aggregate `runtime-tokens` numeric scores for the workflow trace, compared with its configured warning |
| Failed outcome | `outcome = failed`; gate scores named `evidence-failure` with Boolean value 1 |
| Unknown outcome | `outcome = unknown`, or evidence expired or head differs from the current artifact head |
| Capture gaps | `kind = capture.gap`, `childCoverage != complete`, or missing expected hook/terminal marker; inspect local outbox status too |
| Expected red or recovered error | `reason = expected-red` or `recovered`; keep separate from unrecovered workflow failure |

A backend cannot report an event it never received. Pair backend views with `cli.mjs status` and the host's hook inventory. A silent hook is unknown capture, not a successful run.

`monitorRules` creates two workflow-scoped backend predicates. The token warning sums the trace's `runtime-tokens` numeric scores over one hour. Score deduplication prevents transient observation duplicates from inflating this predicate. The evidence rule counts Boolean failure scores with value 1. `tokenWarning` is configurable and imposes no execution limit. The webhook's monitor name includes the workflow and trace evidence; its filters, metric value, threshold, rule and data permalink identify the observed condition. Langfuse owns alert state and unresolved-alert suppression. Deterministic observation and score IDs keep retries on the same evidence.

For the retained local trial, run `pilot/alerts.py configure` once per private registry and `pilot/alerts.py read` after the normal monitor scheduler evaluates. Reuse the registry on replay. The receiver check requires one actual ALERT per predicate, including after event replay. It never uses a test-fire API. `scores` verifies supplied evidence and a versioned check; it provides no autonomous claim grader.

## Cost by helper

Request metadata carries `helper: build | reviewer | verifier | council | autoreview`. New helper briefs supply the role; sessions without a role marker use `build`. Historical unlabelled helpers cannot be separated by role without independent ownership evidence.

Save every page of the workflow's `GET /api/public/v2/observations?traceId=<trace>&fields=core,basic,usage,model,metadata` readback as `observations-<page>.json`. This query deduplicates observation IDs and groups the backend's measured cost by helper:

```sh
jq -s '
  [.[].data[] | select(.name == "provider.request")]
  | unique_by(.id)
  | group_by(.metadata.helper // "unknown")
  | map({helper: (.[0].metadata.helper // "unknown"),
         requests: length,
         unpriced: ([.[] | select((.calculatedTotalCost // .totalCost) == null)] | length),
         cost: (if all(.[]; (.calculatedTotalCost // .totalCost) != null)
                then [ .[] | (.calculatedTotalCost // .totalCost) ] | add
                else null end)})
' observations-*.json
```

A null cost means at least one request has no backend price. Keep it unknown, including partial autoreview attempts. For authoritative token totals keep using `usageQuery`; this cost view uses deduplicated observation prices and can lag ingestion.

## Thread queries

The general thread capture (`threads/`, schema `t3-thread/v1`) writes to its own project. Each Langfuse session is one T3 thread, or `claude:<id>` / `codex:<id>` for a session T3 doesn't know. `node instrumentation/threads/cli.mjs report <from> <to>` reads every `GET /api/public/v2/observations` page for the range and prints all three views below as JSON. They live in `threads/queries.mjs`:

| Question | View | How |
| --- | --- | --- |
| Cost per thread | `costPerThread` | Generations grouped by `sessionId`, summing `totalCost` |
| Cost per lineage tree | `costPerTree` | Each thread climbs `metadata.launcher` (from `t3_thread_launch`, `create_threads` or `delegate_task`), then `metadata.lineageParent`, to its top thread; the tree sums every thread under it |
| Compactions per thread | `compactionsPerThread` | Events with `metadata.kind = compaction`, with trigger counts and summed `preTokens` and `postTokens`; `handoff` events counted apart |

Each view counts an observation ID once, because rows can repeat while ClickHouse merges a replay. A cost stays null while any request in it has no price, and `unpriced` says how many. Neither runtime logs the usage of the call that writes a compaction summary, so compaction cost is a known gap.

For token totals, sum each generation's `usageDetails` per session. `recount <from> <to>` counts the same totals straight from the transcripts with separate code, so the two can be compared once ClickHouse settles. The thread project sends no `runtime-tokens` scores; at about 290,000 requests a month, one score request per request would not fit the 5-minute schedule.
