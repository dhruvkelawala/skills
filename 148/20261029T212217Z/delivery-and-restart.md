# Accepted events survive rejection and restart

Adapter HEAD `b3ec6ad5b61097fe503e8b078a4083981f3b89a5`, tree `b693d38327ae9ecad46cc3f0c3e151ca31232ea4`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

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
  "head": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "rejection-46a09611-6380-4ddf-8e17-2619b4a47393",
  "eventId": "de32300944792162fe832c6e683cf2126b7b2fb9c6bab29355e35b07d5b60f37",
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
  "head": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "rejection-46a09611-6380-4ddf-8e17-2619b4a47393",
  "eventId": "de32300944792162fe832c6e683cf2126b7b2fb9c6bab29355e35b07d5b60f37",
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
  "head": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "rejection-46a09611-6380-4ddf-8e17-2619b4a47393",
  "eventId": "de32300944792162fe832c6e683cf2126b7b2fb9c6bab29355e35b07d5b60f37",
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
  "head": "b3ec6ad5b61097fe503e8b078a4083981f3b89a5",
  "workflow": "rejection-46a09611-6380-4ddf-8e17-2619b4a47393",
  "eventId": "de32300944792162fe832c6e683cf2126b7b2fb9c6bab29355e35b07d5b60f37",
  "observations": 1,
  "eventPersisted": true
}
```

The earlier batch repair removes repeated history scans from hook acceptance. The unchanged deadline regression passed again at this head. Before the repair, the real CLI failed its assertion that a new request reaches the receiver before the three-second host deadline. After the repair, the same scenario with 2,000 acknowledged requests reached the new request in 292 ms. The source test uses the real adapter, CLI process and HTTP receiver. Full verification passed on the final committed tree. Accepted-event recovery does not prove delivery for events a hook never accepted.
