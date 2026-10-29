# Accepted events survive rejection and restart

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

Each outage stage ran in a separate Node process. Only the trial web and worker stopped, through backend.py and its dedicated socket.

```sh
python3 instrumentation/pilot/backend.py stop langfuse-web langfuse-worker
SKILL_PILOT_STATE=<private-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs status
python3 instrumentation/pilot/backend.py up -d langfuse-web langfuse-worker
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs flush
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs read
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

Fresh-process status:

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

The public read API again returned 240 tokens and one request after recovery. A separate probe used an intentionally invalid test key against the real OTLP endpoint. It then restarted, recovered through the emitter with the valid private configuration, and read the stored event. The keys are excluded.

```json
{
  "phase": "actual-backend-rejection",
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "rejection-aa4eafb0-f59f-407f-8426-f9e4022727f9",
  "eventId": "5e49e24570364fc9494ab11c475b0cb89a66aa2979a3c387edac60e03e58a0f9",
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
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "rejection-aa4eafb0-f59f-407f-8426-f9e4022727f9",
  "eventId": "5e49e24570364fc9494ab11c475b0cb89a66aa2979a3c387edac60e03e58a0f9",
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
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "rejection-aa4eafb0-f59f-407f-8426-f9e4022727f9",
  "eventId": "5e49e24570364fc9494ab11c475b0cb89a66aa2979a3c387edac60e03e58a0f9",
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
  "head": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "workflow": "rejection-aa4eafb0-f59f-407f-8426-f9e4022727f9",
  "eventId": "5e49e24570364fc9494ab11c475b0cb89a66aa2979a3c387edac60e03e58a0f9",
  "observations": 1,
  "eventPersisted": true
}
```

The final repair also removes repeated history scans from hook acceptance. Before the repair, the real CLI failed its assertion that a new request reaches the receiver before the three-second host deadline. After the repair, the same scenario with 2,000 acknowledged requests reached the new request in 256 ms. The source test uses the real adapter, CLI process and HTTP receiver. Full verification passed on the final committed tree. Accepted-event recovery does not prove delivery for events a hook never accepted.
