# Criterion 2: at the end of stage 5 the build thread writes the decisions block, resets its own context and resumes; no other thread watches the PR
head 0149e43f1cf86d69a0928687b19a84e46f9c55eb tree 64fcff310663c9de4c476ba1edbc4ddb5f6aa88b

## SKILL.md stage 5, steps 8 and 9
8. Append the [decisions block](references/run-record.md#decisions) to the record.
9. Reset this thread's context, so the watch and every repair after it start from the record rather than the build's context. A thread on a GPT model, as `models.json` words it, skips this step, records `reset skipped: thread on a GPT model` in the stage report, and goes on to stage 6. Otherwise, in this order:
   1. Call `watch_pull_request` on the PR, so no PR event falls in the gap. Stage 6 keeps the watch it finds.
   2. Run `node <this skill's folder>/scripts/reset.mjs before <record path>`. It saves the stage, `repairs:`, `draft:`, `guide:` and `land:` in the record's `reset:` line. When it refuses a run that was already reset, skip the self-send and go on to stage 6.
   3. As the last call of the turn, call `t3_thread_send` to this thread's own id, with `freshContext: true`, mode `queue`, and the message `/issue-to-pr <n> resume <record path>: fresh context after the stage 5 reset`. The fresh context continues as [resume](references/resume.md#after-a-context-reset) says. It reads state only from the record and the PR. A PR wake that reaches this context after it queued the self-send changes nothing: end the turn, because the fresh context reads the same PR when it resumes.

**Complete when:** an open PR exists at the current head on the contracted base, a draft when the record says `draft: yes` and otherwise ready for review, and is linked to this thread, its file count matches, and its body has a `**Door:**` line and a link or quoted exemption for each criterion. The record holds the decisions block. On a thread not on a GPT model, it also holds the `reset:` snapshot, the PR is watched, and the self-send is queued; otherwise the record says why the reset was skipped.

## references/resume.md, After a context reset
## After a context reset

The stage 5 reset starts this thread again in a fresh context, with a message naming the record. The record's `reset:` line holds the snapshot, and the stage is `published`.

1. Read the record and the PR. Take decisions, findings and their reasons from the record, never from the conversation before the reset, which this context no longer has.
2. Run `node <issue-to-pr>/scripts/reset.mjs after <record>`. On exit 1, the record moved across the reset: record `blocked: reset moved <fields>` with the lines it printed, call `unwatch_pull_request`, and ask the user. Exit 2 means no snapshot, so continue as an ordinary resume. Save its `first request after the reset` line in the stage report. An `over` there is reported for the rollout check in [observability](observability.md#context-reset-rollout), and never stops the run.
3. When observability is enabled, send a `resumed` marker with execution `running` and `reason: context-reset`, under the record's attempt, because the run did not stop, as [observability](observability.md) says.
4. Pick the case as step 3 above does, and run it, keeping the watch stage 5 set. With neither case, run stage 6 once from step 1. The run never goes back through stage 5.

## references/pr-thread.md, Watching
## Watching

The thread watches its PR with `watch_pull_request` only while the PR waits on someone else, such as a running check, a bot or a person. When it's the user's move, as at a clean PR, a held reply, a spent budget or a question, it calls `unwatch_pull_request`, and the thread sits in the user's inbox. A build's thread also watches across its stage 5 context reset, so the fresh context finds the watch already set.

Live reset of this run's own thread: appended after its stage 5.
