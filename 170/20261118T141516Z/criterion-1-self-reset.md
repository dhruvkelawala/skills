# Criterion 1: a thread that resets its own context keeps its PR link, watch and worktree, and the next PR event wakes it

Scratch repo: dhruvkelawala/scratch-fresh-thread-spike, PR #2. Skills base: 5baec097de51ebff2d5a28388200185c1b4dbd81.

## Criterion 1 test: self-reset (protocol)

Scratch PR: https://github.com/dhruvkelawala/scratch-fresh-thread-spike/pull/2 (branch feat/2-self-reset, local clone /tmp/scratch-170). First CI run passed before the watch.

Pre-reset state, 2026-11-18T13:58:01Z:
- thread: mcp:launch:efb0b3f7a41d723784ac709e065c2332b750fa8c69b2ebd912877f7b527a33cf (confirmed as currentThreadId by t3_thread_list)
- list_thread_pull_requests: scratch #2, source created, watching true, open
- t3_worktree_status: attached, ~/.t3/worktrees/skills/feat-170-reset-context--c846ff4fddb7c35f, branch feat/170-reset-context-after-publish
- CLAUDE_CODE_SESSION_ID: 9d6d3e84-ae99-487a-a51a-0e224315536e
- Reset sent by this same thread to itself: t3_thread_send, freshContext true, mode queue, as the last call of the turn.

Turn A (the fresh context the reset starts) does exactly this:
1. Record under "## Criterion 1 test: results": list_thread_pull_requests, t3_worktree_status, pwd, $CLAUDE_CODE_SESSION_ID (must differ from the one above), and the UTC time.
2. Measure the first request's input tokens from the new session's transcript ($CLAUDE_CONFIG_DIR/projects/*/<session>.jsonl, first assistant message usage: input + cache_read + cache_creation) and record it.
3. Push a failing commit to the scratch PR: in /tmp/scratch-170 add a file named FAIL, commit, push. Record the push time.
4. End the turn. No ScheduleWakeup, Monitor or polling.

Turn B must start from T3's PR wake on the failed check:
1. Record how the wake arrived and its time.
2. Clean up: unwatch_pull_request and unlink_pull_request on scratch #2, close it with gh pr close, delete branch feat/2-self-reset.
3. Write the verdict: pass when link, watch and worktree survived and the wake arrived; else record the failure and switch to the /compact fallback as the issue says, and tell the user.
4. Continue the build from this record: SKILL.md stage 1 step 9 (branch at base_sha), then stage 2, under /issue-to-pr 170.

If nothing wakes, the user says "go on" to recover.

## Criterion 1 test: results

Turn A (fresh context after the self-reset), 2026-11-18T13:58:19Z:
- list_thread_pull_requests: scratch #2 (dhruvkelawala/scratch-fresh-thread-spike), source created, watching true, open, head feat/2-self-reset → link and watch survived
- t3_worktree_status: attached, ~/.t3/worktrees/skills/feat-170-reset-context--c846ff4fddb7c35f, branch feat/170-reset-context-after-publish → worktree survived
- pwd: ~/.t3/worktrees/skills/feat-170-reset-context--c846ff4fddb7c35f
- CLAUDE_CODE_SESSION_ID: d210f21d-4240-40db-b79f-012931f6255b (differs from pre-reset 9d6d3e84-ae99-487a-a51a-0e224315536e → fresh session)
- first request input tokens: 67,433 (input 2 + cache_read 29,834 + cache_creation 37,597), from projects/-~--t3-worktrees-skills-feat-170-reset-context--c846ff4fddb7c35f/d210f21d-4240-40db-b79f-012931f6255b.jsonl
- failing push: FAIL file committed as df356638de203770b5a81bf0f78f7a920cc7d268 on feat/2-self-reset, pushed 2026-11-18T13:58:27Z
- Turn A ended with no ScheduleWakeup, Monitor or polling; waiting on T3's PR wake for Turn B.

Turn B, from T3's PR wake:
- wake: T3 Code "Update on pull request #2 … Checks failed on df35663" message naming run 44319227246 (job 134853422939); run concluded failure at 2026-11-18T13:58:41Z, wake handled at 2026-11-18T13:59:01Z (about 34s after the push, about 20s after the check failed)
- cleanup: unwatch_pull_request (wasWatching true), unlink_pull_request (wasLinked true), gh pr close 2 --delete-branch → CLOSED, feat/2-self-reset gone from the remote

Verdict: PASS. After a t3_thread_send freshContext self-reset, the thread came back in a new session (d210f21d… ≠ 9d6d3e84…) with the PR link, the watch and the worktree intact, and T3's PR wake on the failed check reached the fresh context. Starting context was 67,433 tokens. The /compact fallback is not needed.
- criterion 1: PASS at 2026-11-18T13:59:01Z; branch confirmed at base_sha 5baec09 (stage 1 step 9); stage 2 starts

## Failed check that woke the thread

```
{"conclusion":"failure","createdAt":"2026-11-18T13:58:32Z","event":"pull_request","headSha":"df356638de203770b5a81bf0f78f7a920cc7d268","updatedAt":"2026-11-18T13:58:41Z","workflowName":"ci"}
```

## Scratch PR after cleanup
```
{"closedAt":"2026-11-18T13:59:08Z","headRefName":"feat/2-self-reset","state":"CLOSED"}
```
