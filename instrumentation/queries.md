# Pilot queries and warnings

Use the public `GET /api/public/v2/observations` endpoint with `traceId` and `fields=core,basic,usage,model,input,output,metadata`. Paginate until all observations are present. Deduplicate list rows by observation ID before inspecting the event tree. For total tokens and observation counts, use `GET /api/public/v2/metrics?query=<encoded JSON>` with the `usageQuery` exported by `queries.mjs`. Observation rows can repeat temporarily; a row sum is not the supported aggregate.

The observation metadata includes `workflow`, `attempt`, `invocation`, `parent`, `stage`, `execution`, `outcome`, `reason`, `revision` and evidence. Select rows by those fields through the backend's observation filters or inspect the public readback:

| Question | Selection |
| --- | --- |
| Workflow or stage failure | `execution = failed` or `reason = unrecovered`, grouped by workflow/stage |
| High usage | Aggregate `totalTokens` for the workflow trace, compared with its configured warning |
| Failed outcome | `outcome = failed`; gate scores named `evidence-failure` with Boolean value 1 |
| Unknown outcome | `outcome = unknown`, or evidence expired or head differs from the current artifact head |
| Capture gaps | `kind = capture.gap`, `childCoverage != complete`, or missing expected hook/terminal marker; inspect local outbox status too |
| Expected red or recovered error | `reason = expected-red` or `recovered`; keep separate from unrecovered workflow failure |

A backend cannot report an event it never received. Pair backend views with `cli.mjs status` and the host's hook inventory. A silent hook is unknown capture, not a successful run.

`monitorRules` creates two workflow-scoped backend predicates. The token warning sums the unique trace's `totalTokens` over one hour. The evidence rule counts Boolean failure scores with value 1. `tokenWarning` is configurable and imposes no execution limit. The webhook's monitor name includes the workflow and trace evidence; its filters, metric value, threshold, rule and data permalink identify the observed condition. Langfuse owns alert state and unresolved-alert suppression. Deterministic observation and score IDs keep retries on the same evidence.

For the retained local trial, run `pilot/alerts.py configure` once per private registry and `pilot/alerts.py read` after the normal monitor scheduler evaluates. Reuse the registry on replay. The receiver check requires one actual ALERT per predicate, including after event replay. It never uses a test-fire API. `scores` verifies supplied evidence and a versioned check; it provides no autonomous claim grader.
