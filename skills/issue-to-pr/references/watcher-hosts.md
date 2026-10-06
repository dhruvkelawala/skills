# Watcher hosts

The watcher is a helper agent with the `implement-cheap` role. It edits files and runs commands in the current checkout, on the current branch, because its pushes must land on the branch the run record names. Use the role in the table even when the task looks like it needs judgement. The prompt bounds the work, and anything outside it escalates.

| Host | Start the watcher with | Keep it in this checkout by |
| --- | --- | --- |
| Pi or SumoCode | spawn role `implement-cheap`, not visible | passing `worktree: false` |
| Claude Code | the Agent tool, `subagent_type: general-purpose`, model `sonnet` | leaving out `isolation: worktree` |
| Codex | the standard subagent | the default |
| Another host | its standard helper or delegate, cheapest coding option | asking for the current checkout |
| No helper agents | nothing: run the watcher prompt's loop yourself and say so in the report | |

Record `watcher: <role or agent type>` in the run record, so a deviation shows afterwards.

To add a host, add one row.
