# Lifecycle, evidence and run-record ownership

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

The owner flushed its previously accepted waiting marker, then changed only its own telemetry attempt for this resume. It called observe on the real run record with a deliberately wrong input head. The adapter used the owner header and left the record bytes unchanged. These explicit markers are separate from incomplete Codex runtime capture.

```json
{
  "workflow": "015812ae83f72779eb50eb0ec06680849d6017feebcefc6400be302ee3ac1f09",
  "attempt": "be55fdeb-5522-4867-a749-9d6c001457f5",
  "kind": "resumed",
  "execution": "running",
  "stage": "reviewed",
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "revision": "e0a5d420bc934fae8d8fec0b6d01547033218b67f80a7fd7afce59bd74673880",
  "runRecordUnchanged": true,
  "inputHeadOverriddenByRecord": true
}
```

A separately labelled backend fixture exercised the public emitter, ingestion/read APIs and workflow.summarize. Supplied timestamps describe 20 seconds active and 60 waiting. Fresh evidence permits a verified outcome; expired or wrong-head evidence yields unknown. Expected-red and recovered checks produce no ERROR or failure score; the unrecovered check produces one. These are supplied evidence predicates, not autonomous grading or a real host interruption.

```json
{
  "phase": "backend-only-lifecycle-fixture",
  "capturedHead": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "lifecycle-b9e583ac-68fd-49eb-9c75-a1eaa342a862",
  "observations": 10,
  "summary": {
    "activeMs": 20000,
    "waitMs": 60000,
    "execution": "completed",
    "outcome": "verified",
    "repairs": {
      "autonomous": 1,
      "requested": 1
    }
  },
  "expiredOutcome": "unknown",
  "wrongHeadOutcome": "unknown",
  "evidenceFailureScores": 1,
  "errorObservations": 1,
  "expectedRedAndRecoveredDoNotAlert": true,
  "attempts": [
    "second",
    "first"
  ],
  "actualSkillRevision": "e0a5d420bc934fae8d8fec0b6d01547033218b67f80a7fd7afce59bd74673880",
  "quality": "supplied fixture evidence, no autonomous grading"
}
```

