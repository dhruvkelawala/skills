# Accepted events survive rejection and restart

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

Each stage ran as a separate Node process at the adapter HEAD above. The outage stopped only the isolated trial web and worker, using the explicit dedicated socket in backend.py. All other trial dependencies remained running.

```sh
python3 instrumentation/pilot/backend.py stop langfuse-web langfuse-worker
SKILL_PILOT_STATE=<same-private-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-private-directory> node instrumentation/pilot/probe.mjs status
python3 instrumentation/pilot/backend.py up -d langfuse-web langfuse-worker
SKILL_PILOT_STATE=<same-private-directory> node instrumentation/pilot/probe.mjs flush
SKILL_PILOT_STATE=<same-private-directory> node instrumentation/pilot/probe.mjs read
```

Upload during outage:

```json
{
  "phase": "replay",
  "delivery": {
    "status": "flushed",
    "delivered": 0,
    "pending": 3,
    "exhausted": 0,
    "remembered": 0,
    "rejected": 0
  }
}
```
Fresh process status:

```json
{
  "status": "available",
  "pending": 3,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```
Recovery:

```json
{
  "status": "flushed",
  "delivered": 3,
  "pending": 0,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```
The full readback in accounting-and-privacy.md still returned 240 tokens and one request.

A separate driver called the actual OTLP endpoint with an intentionally invalid local test key. The key is excluded. It then flushed through the production emitter, inspected pending status in a fresh process, recovered with the private authenticated configuration and read the event through the public API.

```json
{
  "phase": "actual-backend-rejection",
  "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "rejection-6145f833-c62d-4517-8a36-9cd525b472d8",
  "eventId": "306526221d52a1a6ad12cdf8df048944f2099df6801873fbeedfbd73016aa1f5",
  "backendHTTP": 401,
  "status": "flushed",
  "delivered": 0,
  "pending": 1,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```
```json
{
  "phase": "fresh-process-status",
  "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "rejection-6145f833-c62d-4517-8a36-9cd525b472d8",
  "eventId": "306526221d52a1a6ad12cdf8df048944f2099df6801873fbeedfbd73016aa1f5",
  "status": "available",
  "pending": 1,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```
```json
{
  "phase": "authenticated-recovery",
  "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "rejection-6145f833-c62d-4517-8a36-9cd525b472d8",
  "eventId": "306526221d52a1a6ad12cdf8df048944f2099df6801873fbeedfbd73016aa1f5",
  "status": "flushed",
  "delivered": 1,
  "pending": 0,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```
```json
{
  "phase": "backend-readback",
  "head": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
  "workflow": "rejection-6145f833-c62d-4517-8a36-9cd525b472d8",
  "eventId": "306526221d52a1a6ad12cdf8df048944f2099df6801873fbeedfbd73016aa1f5",
  "observations": 1,
  "eventPersisted": true
}
```
All accepted events recovered. Focused receiver tests additionally cover bounded rejection and exhaustion. No accepted-event loss is claimed for an event that a hook never accepted.
