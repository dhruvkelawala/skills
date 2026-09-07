# Watcher hosts

How to spawn the stage-6 watcher on each host. The rule is the same everywhere: the cheapest subagent that can edit files and run commands, on the current branch, with the watcher prompt as its whole context. Pick from this table; do not upgrade because the task "might need judgment". The prompt bounds the work, and anything outside it escalates.

| Host | Spawn with | Notes |
| --- | --- | --- |
| SumoCode / Pi | `role: implement-cheap`, `worktree: false`, `visible: false` | Roles live in `~/.pi/agent/sumocode/roles.json`. `implement-cheap` is the cheap coding role; the model is whatever that role maps to. Never `implement-smart`, `review`, or `research` for the watcher. |
| Claude Code | `Agent` tool, `subagent_type: general-purpose`, `model: sonnet` | Runs in the current checkout by default. Do not pass `isolation: worktree`. |
| Codex | the standard subagent with the configured lightweight model | Same checkout, same branch. |
| Hermes | the standard delegate with the cheapest coding-capable model enabled | Same checkout, same branch. |
| No subagent support | none | The orchestrator runs `/pr-watch` inline with the same budget and escalation rules. |

Record `watcher: <role or model>` in the run record so a deviation is visible afterwards.

Adding a host: one row, same shape. The core skill does not change.
