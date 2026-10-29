# Installed lifecycle CLI

Captured at HEAD `9e3bd8337bc17f42131e183987ce4fe4124438a6`, tree `15e7c4f47a2149f7be358fd98f4cb1b13f758488`, on 2026-10-29.

The installed skill is a directory symlink, matching the sync-skills installation. Before the repair, the documented command exited zero with no output or upload. The regression reached its assertion, "installed invocation must print its delivery status", with empty stdout. After resolving the argument's real path, the same CLI prints accepted delivery status.

```sh
SKILL_OBSERVABILITY_CONFIG=<private-enabled-config> node <temporary-installed-symlink>/scripts/observe.mjs <owner-record> <marker>
```

The corrected command ran against the real owner run record and the isolated Langfuse backend. The supplied marker deliberately carried the wrong head. The adapter used the owner's header and left the run-record bytes unchanged. The private configuration, credentials and outbox are excluded.

```json
{
  "command": "node <temporary-installed-symlink>/scripts/observe.mjs <owner-record> <marker>",
  "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "tree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "workflow": "015812ae83f72779eb50eb0ec06680849d6017feebcefc6400be302ee3ac1f09",
  "attempt": "2235b88e-edb2-4abb-8c57-c6f1422c4436",
  "eventId": "d602f81fbf3e49467f735f85490566ff2a1a6248d2d17bacffbac71883fafb2a",
  "revision": "52a01708ab369ed67a0e8b30124613082a08ec8ceafd9b9b4899cdf943ba07a4",
  "result": {
    "status": "accepted",
    "eventId": "d602f81fbf3e49467f735f85490566ff2a1a6248d2d17bacffbac71883fafb2a",
    "delivery": {
      "status": "flushed",
      "delivered": 1,
      "pending": 0,
      "exhausted": 0,
      "remembered": 0,
      "rejected": 0
    }
  },
  "runRecordUnchanged": true
}
```

Public API readback:

```json
{
  "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "tree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "stored": {
    "kind": "resumed",
    "execution": "running",
    "stage": "watching",
    "workflow": "015812ae83f72779eb50eb0ec06680849d6017feebcefc6400be302ee3ac1f09",
    "attempt": "2235b88e-edb2-4abb-8c57-c6f1422c4436",
    "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
    "revision": "52a01708ab369ed67a0e8b30124613082a08ec8ceafd9b9b4899cdf943ba07a4",
    "invocation": "issue-to-pr"
  },
  "inputHeadOverridden": true,
  "runRecordUnchanged": true,
  "scope": "installed CLI marker and backend readback; no fresh automatic hook or model execution"
}
```

The regression test also checks workflow, attempt, repository, invocation and stage values from the owner header. No fresh model or automatic provider hook ran in this capture. AC8 remains incomplete with its existing supported trust and session-binding blockers.

Earlier captures at b3ec6ad remain the evidence for accounting, outage/restart, content suppression, lifecycle timing, installed research, alerts and live gates. Those modules are unchanged by this repair.
