# Accounting and source suppression

Adapter HEAD `b3ec6ad5b61097fe503e8b078a4083981f3b89a5`, tree `b693d38327ae9ecad46cc3f0c3e151ca31232ea4`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

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
  "capturedHead": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
  "traceId": "e6d766829bcc7636b49fe3e3922983ec",
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
  "capturedHead": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
  "traceId": "e6d766829bcc7636b49fe3e3922983ec",
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

A separate synthetic completed-transcript probe called the current captureHook with maxEvents=3 and five requests. It delivered three, reported unavailable, then delivered the remaining two on the next call. Unchanged resume uploaded zero. A late usage update and one new request uploaded two; original attempt ownership stayed fixed. Wrong-session capture was refused before transcript access.

```json
{
  "phase": "synthetic-completed-transcript-adapter-readback",
  "capturedHead": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "hook-6d72796b-37e3-4fa1-b46c-28ac6c0b156f",
  "requests": 6,
  "totalTokens": 13,
  "oldAttempt": "first",
  "newAttempt": "second",
  "unchangedReplayUploads": 0,
  "storedCanaryAbsent": true,
  "wrongSessionRefusedBeforeRead": true,
  "notLive": true,
  "equalTimestampReplayTotal": 13
}
```

All six retained outbox records and expanded stored fields excluded the synthetic canary placed in prompt, source, command, tool and error fields. This proves adapter/backend behavior. The public totals API combined early, updated and replayed same-timestamp captures and returned 13 tokens, matching the six unique requests in backend storage. Automatic T3 hooks, inclusive live children and unknown failed-request billing remain incomplete. Costs and unsupported allocation remain unknown.
