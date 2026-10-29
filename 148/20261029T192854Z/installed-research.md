# Installed research and artifact linkage

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

The real Sonnet 5.5 research task loaded the installed research skill, fetched the official hooks documentation, ran an expected failing command and recovered, then wrote research/langfuse-pilot-capture-boundary.md. It started no children. No outside-skill source was copied.

The owner correlated its exposed task and session to a research child marker under issue-to-pr:

```json
{
  "task": "node:delegated-task:command%3Amcp%3A8c543123-c27d-443b-9687-c129b9de29f3%3Adelegate-task%3A5738bdc5-5dd7-4f75-8046-385c26f71b24",
  "parent": "issue-to-pr",
  "session": "24d0c92b-aee8-433d-aa0b-b3679f4b26e5",
  "artifact": {
    "uri": "https://github.com/dhruvkelawala/skills/blob/72f958e9c841d278e4878ad4af4434e1be89ede5/research/langfuse-pilot-capture-boundary.md",
    "sha256": "991b5ad5be7e41c9fdacd90be3b6b5c2091b9656db2304951148a7079a926b2d",
    "head": null,
    "result": "unknown",
    "expires": null
  },
  "outcome": "unknown"
}
```
At the current adapter HEAD, recordExternal rechecked the completed artifact through the actual generic wrapper and backend. It used the installed skill revision and artifact hash, and source references. No issue-to-pr header was required. This recheck is an explicit completed-artifact marker, not a fresh live research execution:

```json
{
  "workflow": "research-artifact-recheck-36086d79-3406-4efe-86e3-fc7c3305fb47",
  "revision": "32ddfa6a191affb6dfc6b6ca7af917c804ecf54210749a10d4e7f8501c2f14c6",
  "artifact": {
    "uri": "https://github.com/dhruvkelawala/skills/blob/feat/148-langfuse-skill-observability/research/langfuse-pilot-capture-boundary.md",
    "sha256": "991b5ad5be7e41c9fdacd90be3b6b5c2091b9656db2304951148a7079a926b2d",
    "head": null,
    "result": "unknown",
    "expires": null
  },
  "evidence": [
    {
      "uri": "https://learn.chatgpt.com/docs/hooks",
      "sha256": "d83234bb8c5c85be8eccc258bf5a9e95c713ba953b41740d0a184f2cece3f880",
      "head": "ab60db0ec35c17d94ade63e6b6deac83a30b16e2",
      "result": "unknown",
      "expires": null
    }
  ],
  "outcome": "unknown"
}
```
The pristine direct-live snapshot below was captured at its stated earlier head before replay and before the exact-session guard. It returned twelve of thirteen source requests. It is incomplete:

```json
{
  "phase": "direct-live-t3-partial",
  "capturedHead": "ab60db0ec35c17d94ade63e6b6deac83a30b16e2",
  "session": "24d0c92b-aee8-433d-aa0b-b3679f4b26e5",
  "sourceRequests": 13,
  "backendRequests": 12,
  "sourceTotals": {
    "input": 28,
    "output": 7226,
    "cache_read": 465459,
    "cache_write_5m": 0,
    "cache_write_1h": 43562
  },
  "backendTotals": {
    "input": 26,
    "output": 6207,
    "cache_read": 422187,
    "cache_write_5m": 0,
    "cache_write_1h": 43272
  },
  "missing": [
    {
      "requestHash": "f86925e9139e374c6065609f01a6ead9194b966b9d245c6cc6bea3d4d1af44ec",
      "usage": {
        "input": 2,
        "output": 1019,
        "cache_read": 43272,
        "cache_write_1h": 290
      }
    }
  ],
  "complete": false,
  "sourceCanaryAbsent": true
}
```
A later completed-transcript replay at the earlier adapter recovered thirteen requests and matched independent source totals:

```json
{
  "phase": "completed-transcript-adapter-replay",
  "sourceHead": "ab60db0ec35c17d94ade63e6b6deac83a30b16e2",
  "session": "24d0c92b-aee8-433d-aa0b-b3679f4b26e5",
  "sourceRequests": 13,
  "backendRequests": 13,
  "uniqueObservations": 15,
  "sourceTotals": {
    "input": 28,
    "output": 7226,
    "cache_read": 465459,
    "cache_write_5m": 0,
    "cache_write_1h": 43562
  },
  "backendTotals": {
    "input": 28,
    "output": 7226,
    "cache_read": 465459,
    "cache_write_5m": 0,
    "cache_write_1h": 43562
  },
  "storedCanaryAbsent": true
}
```
The source prompt canary was absent from stored fields. These categories must remain distinct. Live inclusive child usage and real interruption/resumption are unproved. Unassessed claim support stays unknown.
