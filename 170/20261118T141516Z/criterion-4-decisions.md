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

This run's decisions block: appended after its stage 5.
