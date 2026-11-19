# Criterion 2: live backfill versus independent recount (head 86f01ac, tree 7f119c8, project t3-threads on Langfuse 4.72)

- Backfill: `T3_THREADS_CONFIG=<private> node instrumentation/threads/cli.mjs backfill 2026-10-20T00:00:00Z` -> {"status":"passed","transcripts":4329,"bytes":18745916835,"copied":1516,"deferred":0,"unavailable":0,"pending":0,"exhausted":0} in 157 s.
- Settled: ClickHouse row count unchanged across two reads 100 s apart.
- Comparison: per-session requests and tokens from the project's ClickHouse rows (latest version of each generation, Langfuse's computed `total` usage key excluded) against `recount({from, to})`, window 2026-10-20T00:00:00Z to 2026-11-19T13:00:00Z. Session IDs are SHA-256 prefixes.

```json
{
 "from": "2026-10-20T00:00:00Z",
 "to": "2026-11-19T13:00:00Z",
 "sessions": 3374,
 "t3Sessions": 2797,
 "langfuse": {
  "requests": 291475,
  "tokens": 58584385821
 },
 "recount": {
  "requests": 290382,
  "tokens": 58281686660
 },
 "mismatchedSessions": 3,
 "mismatches": [
  {
   "session": "dc7c56e680",
   "t3": true,
   "langfuse": {
    "requests": 295,
    "tokens": 63291090
   },
   "recount": null
  },
  {
   "session": "60da38174f",
   "t3": true,
   "langfuse": {
    "requests": 363,
    "tokens": 95873802
   },
   "recount": null
  },
  {
   "session": "674f368765",
   "t3": true,
   "langfuse": {
    "requests": 435,
    "tokens": 143534269
   },
   "recount": null
  }
 ]
}
```

The three remaining sessions have no transcript left on disk (checked by their T3 native IDs), so the recount cannot see them; Langfuse kept what the backfill sent before they were deleted.

Earlier comparisons found five real defects, each fixed test-first before this run: 03502da, 616d5e7, eae75df, 2f29833, cd2757b, 86f01ac (see the PR body).
