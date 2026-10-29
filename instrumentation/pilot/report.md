# Controlled pilot status

Issue #148 implements a controlled pilot; live rollout remains gated. This document records measured limits; synthetic passes do not establish broad rollout readiness.

The shared metadata emitter, bounded durable outbox, narrow provider usage adapters and external-skill wrapper are implemented. Issue-to-pr remains the single writer of its run record. Review, repair and merge authority are unchanged. Research stays outside this repository.

Backend fixture readback preserved 240 tokens, including 50 cache reads and 10 reasoning tokens. All stored fields inspected for that fixture excluded the prompt/source/command/tool/error canary. The legacy trace ingestion API is rejected by the pinned Langfuse v4; the pilot uses OTLP and the public scores API.

A new exact-ID replay temporarily returned 480 tokens from the ordinary observation aggregate, then converged to 240. This observation does not change the parent's earlier measured aggregate result, which stayed at five observations and 240 tokens. It does limit any stronger guarantee. Authoritative pilot usage and warning predicates therefore use stable per-request `runtime-tokens` numeric scores, read through Langfuse's deduplicated score aggregates. These scores are measured counters, not quality grades. OTLP retains the original token categories and semantics for inspection. Replay evidence and real predicate receipts are captured separately.

The current Codex app-server schema exposes `hooks/list` and no hook-trust mutation. The shell environment does not expose the T3 provider's CODEX_HOME. Generated exact project-hook commands are ready for review; no trust store was patched and no bypass was used. Direct live Codex capture remains incomplete until a supported same-profile human `/hooks` action and a fresh T3 probe can be verified. Missing host linkage and native failures remain explicit coverage gaps.

A fresh T3 Sonnet 5.5 task loaded the installed research skill and wrote the [hook-boundary artifact](../../research/langfuse-pilot-capture-boundary.md). Automatic hooks delivered twelve unique provider requests directly to Langfuse, plus start/finish markers. Independent source inspection found thirteen requests: input 28, output 7,226, cache read 465,459 and one-hour cache write 43,562. Live storage lacked the final request (input 2, output 1,019, cache read 43,272, one-hour cache write 290). A separately labelled completed-transcript adapter replay recovered all thirteen and matched those source totals. Stored fields excluded the prompt canary. The live snapshot was preserved before replay. The exact final-row hook timing is unproved; automatic completeness, child linkage and real interruption/resumption remain incomplete. Earlier bake-off Claude evidence remains live-to-receiver followed by exact-byte backend replay, a different claim.

Quality outcomes require supplied fresh evidence at the matching head and a recorded judge/rubric where applicable. The pilot supplies no autonomous claim-support grader. Unknown or stale evidence remains unknown.

A real backend outage left three accepted fixture events pending. A fresh Node process read the same pending count; after restoration another process delivered all three with no exhausted or rejected events. Rejection, exhaustion and bounds are also exercised through the caller-facing local receiver tests.

Initial monitor exploration changed the token rule from observations to scores. Its historical receipts contain an ALERT, an OK during that rule transition, and a new score-based ALERT. That history is not duplicate unresolved delivery and cannot satisfy the helper’s stricter exactly-one-ever assertion. Final replay proof uses a fresh workflow and unchanged score predicates.
