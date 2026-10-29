# Controlled pilot status

Implementation for issue #148 is in progress. This document records measured limits; synthetic passes do not establish broad rollout readiness.

The shared metadata emitter, bounded durable outbox, narrow provider usage adapters and external-skill wrapper are implemented. Issue-to-pr remains the single writer of its run record. Review, repair and merge authority are unchanged. Research stays outside this repository.

Backend fixture readback preserved 240 tokens, including 50 cache reads and 10 reasoning tokens. All stored fields inspected for that fixture excluded the prompt/source/command/tool/error canary. The legacy trace ingestion API is rejected by the pinned Langfuse v4; the pilot uses OTLP and the public scores API.

A new exact-ID replay temporarily returned 480 tokens from the ordinary observation aggregate, then converged to 240. This observation does not change the parent's earlier measured aggregate result, which stayed at five observations and 240 tokens. It does limit any stronger guarantee. Authoritative pilot usage and warning predicates therefore use stable per-request `runtime-tokens` numeric scores, read through Langfuse's deduplicated score aggregates. These scores are measured counters, not quality grades. OTLP retains the original token categories and semantics for inspection. Replay evidence and real predicate receipts are captured separately.

The current Codex app-server schema exposes `hooks/list` and no hook-trust mutation. The shell environment does not expose the T3 provider's CODEX_HOME. Generated exact project-hook commands are ready for review; no trust store was patched and no bypass was used. Direct live Codex capture remains incomplete until a supported same-profile human `/hooks` action and a fresh T3 probe can be verified. Missing host linkage and native failures remain explicit coverage gaps.

Direct live Claude research capture and real workflow interruption/resumption proof are pending the bounded Sonnet probe. Existing Claude evidence from the bake-off remains live-to-receiver followed by exact-byte backend replay. It is not direct live-to-backend evidence for this implementation.

Quality outcomes require supplied fresh evidence at the matching head and a recorded judge/rubric where applicable. The pilot supplies no autonomous claim-support grader. Unknown or stale evidence remains unknown.
