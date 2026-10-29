# Accounting and source suppression

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

Commands from the repository root, with one fresh private registry reused throughout:

```sh
SKILL_PILOT_STATE=<private-directory> node instrumentation/pilot/probe.mjs seed
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs read
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs read
```

This backend-only fixture repeats one source row. Independent input is 200 including 50 cache reads; output is 40 including 10 reasoning tokens. The stored categories sum to 150 + 50 + 30 + 10 = 240.

Before replay:

```json
{
  "phase": "backend-only-fixture",
  "capturedHead": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
  "traceId": "66b718016c78c3f1898fe6a5bf1a6914",
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

After replay and outage recovery:

```json
{
  "phase": "backend-only-fixture",
  "capturedHead": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
  "traceId": "66b718016c78c3f1898fe6a5bf1a6914",
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

A separate synthetic completed-transcript probe called the current captureHook with maxEvents=3 and five requests. It delivered three, reported unavailable, then delivered the remaining two on the next call. Unchanged resume uploaded zero. A late usage update and one new request uploaded two; original attempt ownership stayed fixed. Wrong-session capture was refused before transcript access.

```json
{
  "phase": "synthetic-completed-transcript-adapter-readback",
  "capturedHead": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "hook-dba2c4f9-897b-4928-8308-bd877621904d",
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

All six retained outbox records and expanded stored fields excluded the synthetic canary placed in prompt, source, command, tool and error fields. This proves adapter/backend behavior. Automatic T3 hooks, inclusive live children and unknown failed-request billing remain incomplete. Costs and unsupported allocation remain unknown.
