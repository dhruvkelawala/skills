# Accounting and source suppression

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

Commands run from the repository root:

```sh
SKILL_PILOT_STATE=<fresh-private-directory> node instrumentation/pilot/probe.mjs seed
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs read
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs read
```

This is a backend-only fixture. Its independent expectation is 200 input tokens including 50 cache reads, and 40 output tokens including 10 reasoning tokens. Storage categories are 150 + 50 + 30 + 10 = 240, one request, three observations. The same source row appears twice in the fixture.

Before replay:

```json
{
  "phase": "backend-only-fixture",
  "capturedHead": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6",
  "traceId": "5c13a62f5d1f586b4412a63cdfe99471",
  "uniqueObservations": 3,
  "rawRows": 3,
  "sourceTotals": {
    "total": 240,
    "requests": 1,
    "observations": 3
  },
  "metrics": {
    "data": [
      {
        "sum_value": 240,
        "count_count": 1
      }
    ]
  },
  "usageDetails": {
    "input": 150,
    "output": 30,
    "cache_read": 50,
    "reasoning": 10,
    "total": 240
  },
  "evidenceFailureScores": 1,
  "storedCanaryAbsent": true
}
```
After replay and a real outage/recovery:

```json
{
  "phase": "backend-only-fixture",
  "capturedHead": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6",
  "traceId": "5c13a62f5d1f586b4412a63cdfe99471",
  "uniqueObservations": 3,
  "rawRows": 9,
  "sourceTotals": {
    "total": 240,
    "requests": 1,
    "observations": 3
  },
  "metrics": {
    "data": [
      {
        "sum_value": 240,
        "count_count": 1
      }
    ]
  },
  "usageDetails": {
    "input": 150,
    "output": 30,
    "cache_read": 50,
    "reasoning": 10,
    "total": 240
  },
  "evidenceFailureScores": 1,
  "storedCanaryAbsent": true
}
```
A separate synthetic completed-transcript capture exercised the real captureHook entry point and real backend. First call accepted/flushed 3 of 5 requests and reported unavailable; second delivered the remaining 2. An unchanged resume uploaded 0; one late usage update and one new request uploaded 2. The original request retained its first attempt. Each input row carried a canary in prompt/source/command/tool/error locations. The expanded backend metadata and input/output readback contained none.

```json
{
  "phase": "synthetic-completed-transcript-adapter-readback",
  "capturedHead": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "hook-b7cec75c-18fb-4b66-ade2-a9757f715ab8",
  "requests": 6,
  "totalTokens": 13,
  "oldAttempt": "first",
  "newAttempt": "second",
  "unchangedReplayUploads": 0,
  "storedCanaryAbsent": true,
  "wrongSessionRefusedBeforeRead": true,
  "notLive": true
}
```
These are adapter/backend probes. They do not prove automatic T3 hooks. Unknown costs, ambiguous exclusive allocation and missing child coverage remain unknown or partial.
