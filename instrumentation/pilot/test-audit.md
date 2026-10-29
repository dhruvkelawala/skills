# Test ownership

Each case uses the public emitter, CLI, accounting or workflow interface. HTTP receivers replace only the external backend in focused tests. Actual ingestion/read/predicate behavior is checked separately by the pilot commands. No test-only production export or vendor patch was added.

| Owning test | Observable contract and credible regression | Why existing proof misses it |
| --- | --- | --- |
| contract | Identity and actual revision; conflating load/start/finish or hashing a Git SHA instead of changed instructions fails | No shared run contract existed |
| accounting, unique requests | Literal independently worked totals, stream dedup, failed usage gaps and child inclusion; summing every stream row fails | Backend replay cannot establish source counter semantics |
| accounting, Codex | Cumulative deltas, included reasoning/cache and resume replay; adding snapshots fails | Claude uses different counter semantics |
| accounting, unknown duration | Exposed aggregate cache writes survive without invented 5m/1h allocation; dropping the unsplit counter fails | The split-cache fixture cannot expose this loss |
| delivery | Persisted acceptance, rejected upload, fresh-process status, retry, exhaustion and bounded rejection; advancing progress on export failure fails | In-memory accounting cannot reach crash/retry lifecycle |
| privacy | The actual project-hook CLI omits content from outbox and output; serializing tool/error/input objects fails | Contract field validation alone cannot prove the hook path uses it |
| workflow | Wait time, resumed attempts, repair categories and stale/missing evidence; equating completion with verified success fails | Provider counters have no workflow quality semantics |
| external | A separate skill's actual revision, artifact and source references; requiring PR fields or copying content fails | issue-to-pr cannot prove the generic outside-skill boundary |
| queries | Public backend rule definitions scope warnings and use version-correct Boolean filters and stable score aggregation; project-wide filters or observation sums fail | Fake receiver tests cannot prove a backend query declaration |

Red runs reached each new contract assertion before implementation. The initial workflow stub returned null and failed at its first timing assertion; other stubs returned empty/unavailable values. The query authoring case was corrected against the actual backend's `booleanValue` schema after its real metrics API rejected `value`. The ordinary observation aggregate's measured transient replay inflation drove the runtime-score query regression. These are retained independent API/config contracts, not copies of implementation inventories.
