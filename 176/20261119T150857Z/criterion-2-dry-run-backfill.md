# Criterion 2: dry-run backfill and independent recount on real transcripts (head 38a5774, local sink, not Langfuse)

Backfill 2026-10-20T00:00:00Z to 2026-11-19T12:27:04Z through `backfill()` into a local OTLP sink; recount through `recount()`; session IDs hashed.

```json
{
 "from": "2026-10-20T00:00:00Z",
 "to": "2026-11-19T12:27:04Z",
 "backfillMs": 147950,
 "recountMs": 39823,
 "result": {
  "status": "passed",
  "transcripts": 4197,
  "bytes": 18219934995,
  "events": 836607,
  "copied": 767,
  "deferred": 0,
  "unavailable": 0,
  "t3": "available",
  "pending": 0,
  "exhausted": 0
 },
 "posts": 1297,
 "spans": 648282,
 "sessions": 3258,
 "t3Sessions": 2781,
 "sent": {
  "requests": 281798,
  "tokens": 56961783496
 },
 "recount": {
  "requests": 281797,
  "tokens": 56961533408
 },
 "mismatches": 3,
 "sample": [
  {
   "session": "71b8c627e9",
   "t3": true,
   "sent": {
    "requests": 71,
    "tokens": 11248283
   },
   "recount": {
    "requests": 70,
    "tokens": 11033205
   }
  },
  {
   "session": "c2d0678247",
   "t3": true,
   "sent": {
    "requests": 227,
    "tokens": 74202823
   },
   "recount": {
    "requests": 226,
    "tokens": 73784560
   }
  },
  {
   "session": "0f3876f54d",
   "t3": true,
   "sent": {
    "requests": 136,
    "tokens": 30588572
   },
   "recount": {
    "requests": 137,
    "tokens": 30971825
   }
  }
 ]
}
```

Per-file follow-up: two of the three differing sessions agree on a re-read (they were live and grew between the two reads); the third differs by one Claude request whose streamed rows straddle `to` (12:26:54 and 12:27:04.057), which capture stamps with its latest row. No request was lost or doubled.

Live comparison against the thread project is pending Dhruv's go-ahead to create it.
