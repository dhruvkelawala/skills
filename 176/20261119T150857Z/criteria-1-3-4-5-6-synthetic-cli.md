# Criteria 1, 3, 4, 5, 6: synthetic CLI run at 72f27a4 (tree 114dad4)

`node instrumentation/threads/cli.mjs pass` run twice as a subprocess with T3_THREADS_CONFIG pointing at a private synthetic config, HOME at a synthetic home, a synthetic statev2.sqlite and a local OTLP collector. Script: synthetic-cli-evidence.mjs. Canary text was planted in every content field.

```json
{
 "criterion1_first_pass": {
  "status": "passed",
  "transcripts": 4,
  "bytes": 3954,
  "events": 10,
  "copied": 3,
  "deferred": 0,
  "unavailable": 0,
  "t3": "available",
  "pending": 0,
  "exhausted": 0
 },
 "criterion1_sessions": {
  "root": {
   "requests": 1,
   "tokens": 135
  },
  "launched": {
   "requests": 1,
   "tokens": 135
  },
  "codex:01a1aaaa-0000-7000-8000-00000000000a": {
   "requests": 2,
   "tokens": 258100
  },
  "claude:22222222-0000-4000-8000-000000000000": {
   "requests": 1,
   "tokens": 135
  }
 },
 "criterion1_t3_tags": {
  "root": "true",
  "launched": "true",
  "codex:01a1aaaa-0000-7000-8000-00000000000a": "false",
  "claude:22222222-0000-4000-8000-000000000000": "false"
 },
 "criterion3_rerun": {
  "status": "passed",
  "transcripts": 0,
  "bytes": 0,
  "events": 0,
  "copied": 0,
  "deferred": 0,
  "unavailable": 0,
  "t3": "available",
  "pending": 0,
  "exhausted": 0
 },
 "criterion3_posts_added_by_rerun": 0,
 "criterion3_distinct_generations": 5,
 "criterion3_copied_under_resumed": 1,
 "criterion4_root_trace": {
  "title": "Synthetic build",
  "project": "Synthetic project",
  "branch": "feat/9-synthetic",
  "worktree": "/work/.t3/worktrees/synthetic/feat-9",
  "lineageRoot": "root",
  "run": "run:root:0",
  "workflow": "wf-synthetic"
 },
 "criterion4_launched_trace": {
  "launcher": "root",
  "createdBy": "agent",
  "creationSource": "mcp",
  "workflow": "wf-synthetic"
 },
 "criterion5_events": [
  {
   "session": "root",
   "type": "event",
   "kind": "compaction",
   "trigger": "auto",
   "preTokens": "300000",
   "postTokens": "20000"
  },
  {
   "session": "codex:01a1aaaa-0000-7000-8000-00000000000a",
   "type": "event",
   "kind": "handoff",
   "trigger": null,
   "preTokens": null,
   "postTokens": null
  },
  {
   "session": "codex:01a1aaaa-0000-7000-8000-00000000000a",
   "type": "event",
   "kind": "compaction",
   "trigger": null,
   "preTokens": "240000",
   "postTokens": "18000"
  }
 ],
 "criterion6_tools": [
  {
   "name": "Bash",
   "seconds": 3,
   "error": "true",
   "level": "ERROR"
  }
 ],
 "criterion6_canary_in_network_payload": false,
 "criterion6_canary_in_outbox": false,
 "criterion6_canary_planted_in": "prompt, reply text, tool_use input, tool_result content, toolUseResult, compaction summaries, Codex replacement history",
 "status": {
  "status": "available",
  "pending": 0,
  "exhausted": 0
 }
}
```
