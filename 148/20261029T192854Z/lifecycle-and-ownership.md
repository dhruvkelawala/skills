# Lifecycle, evidence and run-record ownership

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

The owning build called skills/issue-to-pr/scripts/observe.mjs on its real run record. The caller supplied a deliberately wrong head; the adapter read the owner header and used the recorded head. The run-record bytes were identical before and after observe. The owner changed the telemetry attempt on this resume. These are explicit lifecycle markers, separate from incomplete Codex runtime capture.

```json
{
  "owner": {
    "workflow": "015812ae83f72779eb50eb0ec06680849d6017feebcefc6400be302ee3ac1f09",
    "attempt": "db899f0e-7b83-4065-972f-3237d0cd8d10",
    "kind": "resumed",
    "execution": "running",
    "stage": "implemented",
    "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
    "revision": "e0a5d420bc934fae8d8fec0b6d01547033218b67f80a7fd7afce59bd74673880",
    "runRecordUnchanged": true,
    "inputHeadOverriddenByRecord": true
  },
  "limits": "manual markers; current runtime live capture and inclusive live child totals remain incomplete"
}
```
A separately labelled API fixture exercised the public emitter, real ingestion/read APIs and public workflow.summarize API. Its supplied timestamps describe 10 seconds active, 60 seconds waiting, then 10 seconds active. It records one autonomous repair, one requested repair and three checks with expected-red, recovered and unrecovered reasons.

The backend returned ten distinct observations, one ERROR and one evidence-failure score. Expected-red/recovered produced neither. The outcome is verified only against supplied fresh matching-head evidence. Advancing time or changing the head makes it unknown. This fixture proves evidence predicates and reporting, not autonomous quality judgment or a real host interruption.

```json
{
  "phase": "backend-only-lifecycle-fixture",
  "capturedHead": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "lifecycle-93dd3cd4-7018-457e-adc3-fd70eea25f43",
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
