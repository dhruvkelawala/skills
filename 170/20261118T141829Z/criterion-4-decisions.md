# Criterion 4: in stage 8 the thread answers "why X?" from the decisions block and the record
head 0149e43f1cf86d69a0928687b19a84e46f9c55eb tree 64fcff310663c9de4c476ba1edbc4ddb5f6aa88b

## SKILL.md stage 8 step 1
252:1. Take the user's comments from chat, which works on a phone, from "Ask agent" on a guide excerpt, and from "Add to agent" in the Code tab. Answer a question in chat. Answer "why X?" from the record: every `## Decisions` section, the contract and the findings with their reasons. Quote the line you used, and when the record has none, say so instead of reconstructing a reason. Make each request one fix commit, with its focused tests, and record it with `repairs.mjs add --asked`, the comment as its `--fix`.

## references/run-record.md, Decisions
## Decisions

Stage 5 appends a `## Decisions, <UTC time>` section before the thread resets its context. It is the memory the fresh context and the user's "why X?" in stage 8 read, so it holds every choice the PR's shape depends on that the code and the contract don't already say:

```md
## Decisions, <UTC time>
- <decision, as the PR shows it>: <why>. Source: contract | finding <key> | build | user
```

Cover the contract's decisions, each rejected finding with its reason, each P2 or P3 deferred to follow-ups, each judgement call made while building, such as a test seam or a dropped approach, and each thing the user asked for. A later stage that makes such a choice appends a new `## Decisions, <UTC time>` section in the same line format, so the record stays append-only.

## This run's decisions block, written at stage 5 before the reset (from the run record)

## Decisions, 2026-11-18T14:16:25Z
- Watch before the reset: stage 5 calls watch_pull_request before the self-send, so no PR event falls in the gap; stage 6 keeps it. Source: contract
- Claude only: the reset runs on threads not on a GPT model, reusing models.json's "thread on a GPT model" wording; Codex threads skip it and say so. Source: contract
- The self-send names the record path; the fresh context reads state only from the record and the PR. Source: contract
- Telemetry: one reason value, context-reset, on the resumed marker; no new event kind. Source: contract
- The reset keeps the record's telemetry attempt, because the run never stopped (observability.md otherwise mints a new attempt on resume). Source: build
- The snapshot is a single-line JSON header, reset:, like autoreview_plan; absent fields stay absent (null). Source: build
- A second reset.mjs before refuses, so a fresh context never resets the run again. Source: build
- reset.mjs after is read-only and reports the first request against 100k without changing its exit; an over is for the rollout check, never a stop. Source: build
- The first-request count reuses instrumentation/accounting.mjs captureRequests rather than its own parser. Source: review-ready (ownership)
- The fresh context takes the reset path only when its message says "fresh context after the stage 5 reset" and the stage is still published; every other resume picks resume.md's cases. Source: finding review/reset-resume-routing
- A PR wake reaching the old context after it queued the self-send ends the turn. Source: finding review/reset-resume-flow
- The decisions block is written on every thread, not only resetting ones, since stage 8's "why X?" applies to every run. Source: finding (pass 1 spec)
- Rejected: firstRequest might read the build's request if freshContext kept the session id; criterion 1 showed a new session id. Source: finding (pass 1 standards)
- Rejected: "thread on a GPT model" not runnable; it is models.json's wording and the thread knows its model. Source: finding (pass 1 standards)
- Deferred to follow-ups: runtime fallback when t3_thread_send fails; fold the land test into the moved-field table; move the wake rule into stage 6; trim time-bound rollout text later; dedupe "never resets again"; name the 100k source. Source: review P2/P3
- Criteria 2 and 4 share one docs commit (19f479f), because SKILL.md and run-record.md carry both. Source: build

The fresh context after the reset (session d5886e76-e64d-4449-a4af-cb183c4ccfb6) has none of the build conversation, so the block above and the record's findings are what stage 8 can quote. Example: asked "why does the reset keep the old telemetry attempt?", the answer quotes "The reset keeps the record's telemetry attempt, because the run never stopped ... Source: build".
