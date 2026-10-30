# Isolated pilot commands

The retained trial uses Langfuse 4.72.0 and the [pinned images](image-pins.json). It reuses the bake-off's private Compose deployment and volumes. No command chooses a Docker context, pulls another backend, invokes a model or changes provider configuration. A fresh machine needs an isolated Langfuse OSS deployment first; these commands deliberately require the retained private installation rather than copying its secrets into this repo.

The private root defaults to `/Volumes/SumoDeus NVMe/skill-observability-bakeoff`. `SKILL_PILOT_PRIVATE` can select another retained trial root. `backend.py` always addresses the dedicated socket `unix:///Volumes/SumoDeus NVMe/sob/bakeoff/docker.sock` with a private Docker config. All databases and the alert receiver stay off host ports. The web API is on loopback 3307. Never point these commands at incumbent services.

```sh
COLIMA_HOME='/Volumes/SumoDeus NVMe/sob' colima start --profile bakeoff --activate=false --ssh-config=false
python3 instrumentation/pilot/backend.py up -d
export SKILL_PILOT_STATE="$HOME/.cache/skill-observability-pilot"
mkdir -m 700 -p "$SKILL_PILOT_STATE"
node instrumentation/pilot/probe.mjs seed
```

`seed` writes a private fixture registry and uploads metadata through the real emitter and OTLP endpoint, then sends deterministic evidence and runtime-token scores through the scores API. It requires no model. It expects one measured request, 240 total tokens, 50 cache reads and 10 reasoning tokens. The API may acknowledge before observations become readable. Run `read` after ingestion settles; an assertion failure is a failure, not an expected pass.

```sh
node instrumentation/pilot/probe.mjs read
SKILL_TOKEN_WARNING=100 python3 instrumentation/pilot/alerts.py configure
python3 instrumentation/pilot/alerts.py read
node instrumentation/pilot/probe.mjs replay
node instrumentation/pilot/probe.mjs read
python3 instrumentation/pilot/alerts.py read
```

The normal monitor scheduler runs every 30 seconds. Read receipts after it evaluates. `configure` refuses a second registry; `update` updates those same monitor IDs when deliberately changing a rule. A zero token warning is allowed; it still only warns. Receipt assertions require exactly one unresolved ALERT per rule after replay. The receiver and predicates belong to Langfuse. Fixture evidence establishes storage and predicate behavior, not autonomous research quality.

For outage and restart proof, stop just the trial web and worker services with the explicit backend command, emit another fixture or workflow marker, and inspect pending status in a fresh process. Restore those services and flush the same private outbox. Keep the failed upload, fresh-process status, recovery receipt and readback as separate captures. Do not run `seed` again in the same registry, because it deliberately creates a fresh workflow.

```sh
python3 instrumentation/pilot/backend.py stop langfuse-web langfuse-worker
node instrumentation/pilot/probe.mjs replay
node instrumentation/pilot/probe.mjs status
python3 instrumentation/pilot/backend.py up -d langfuse-web langfuse-worker
node instrumentation/pilot/probe.mjs flush
node instrumentation/pilot/probe.mjs read
```

Use the shared [setup](../README.md) for actual provider hooks. Separate direct live T3 capture, standalone adapter replay and backend-only fixtures in every report. A hook that did not run cannot pass through a fixture or a trust-file edit.

After all probes and live hooks finish:

```sh
python3 instrumentation/pilot/backend.py stop
COLIMA_HOME='/Volumes/SumoDeus NVMe/sob' colima stop --profile bakeoff
```

Confirm the original Docker context and incumbent container count. Preserve trial volumes, the parent's research and private evidence. The new code carries over only backend pins, the isolated Compose invocation, supported API recipes and independent fixture values. It contains no vendor adapter source or outside research skill. The narrow metadata adapters replace content-exporting hooks and use no private vendor imports.
