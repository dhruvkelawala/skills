# Lifecycle, evidence and run-record ownership

Adapter HEAD `b3ec6ad5b61097fe503e8b078a4083981f3b89a5`, tree `b693d38327ae9ecad46cc3f0c3e151ca31232ea4`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

The owner created another resume attempt and emitted its marker from the current run-record header. It called observe on the real run record with a deliberately wrong input head. The adapter used the owner header and left the record bytes unchanged. These explicit markers are separate from incomplete Codex runtime capture.

```json
{
  "workflow": "015812ae83f72779eb50eb0ec06680849d6017feebcefc6400be302ee3ac1f09",
  "attempt": "2235b88e-edb2-4abb-8c57-c6f1422c4436",
  "kind": "resumed",
  "execution": "running",
  "stage": "repairing",
  "head": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "revision": "e0a5d420bc934fae8d8fec0b6d01547033218b67f80a7fd7afce59bd74673880",
  "runRecordUnchanged": true,
  "inputHeadOverriddenByRecord": true
}
```

A separately labelled backend fixture exercised the public emitter, ingestion/read APIs and workflow.summarize. Supplied timestamps describe 20 seconds active and 60 waiting. Fresh evidence permits a verified outcome; expired or wrong-head evidence yields unknown. Expected-red and recovered checks produce no ERROR or failure score; the unrecovered check produces one. The fixture also includes a failed provider request and its successful retry. That request keeps its own ERROR observation, while the workflow stays active until completion. Thus there are two ERROR observations but only one evidence-failure score. These are supplied evidence predicates, not autonomous grading or a real host interruption.

```json
{
  "phase": "backend-only-lifecycle-fixture",
  "capturedHead": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "lifecycle-8006bf59-735c-4953-a3fe-1cf7f130ef41",
  "observations": 12,
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
  "errorObservations": 2,
  "requestFailureLeavesWorkflowCompleted": true,
  "expectedRedAndRecoveredDoNotAlert": true,
  "attempts": [
    "second",
    "first"
  ],
  "actualSkillRevision": "e0a5d420bc934fae8d8fec0b6d01547033218b67f80a7fd7afce59bd74673880",
  "quality": "supplied fixture evidence, no autonomous grading"
}
```

