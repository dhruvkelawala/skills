# pr-review eval, return visits, d9d071f

## push return-visit (d9d071f)

Events in transcript order:

call  t3:write_pull_request_guides [{"url":"https://github.com/acme/demo/pull/7"}]
  ←   guide run: started for 0470a25
call  t3:orchestrator_capabilities
call  Skill code-review
call  Bash cd ~/.agent/pr-review/work/7 && git rev-parse refs/pr-review/7-base && git log refs/pr-review/7-base..HEAD --oneline && ls -a && cat package.json; ls CODING_STANDARDS.md …
call  Bash cd ~/.agent/pr-review/work/7 && ~/.agents/skills/autoreview/scripts/autoreview --mode branch --base 08167515495017dc9c6470036c384ed36bc04b5b --engine codex --model gpt-6.…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
  ←   second opinion: autoreview findings: 0, overall: patch is correct (0.90)
call  t3:task_status
  ←   report: ## Standards
call  t3:task_status
  ←   report: ## Spec
call  t3:read_pull_request_guide
  ←   guide: run=Running guide=written for 9300b7b stale=true head=0470a25
call  Bash sleep 60
call  t3:read_pull_request_guide
  ←   guide: run=Completed guide=written for 0470a25 stale=false head=0470a25
text  INTRO: https://github.com/acme/demo/pull/7. The tour is in the PR panel's Guide tab, and it has been rewritten for the new head, `0470a25`. **Sinc…

The review:

https://github.com/acme/demo/pull/7. The tour is in the PR panel's Guide tab, and it has been rewritten for the new head, `0470a25`.

**Since you last looked:** last time you approved at `9300b7b`, with nothing posted and no GitHub threads. Both P1s from then are fixed, the test gap is partly fixed, and the `n`/`ms` naming note and your question about which errors to retry are still open. This is a real change, not a rebase. The new commit `0470a25` changes three things:
- `src/client.js:10` now passes `retries: retryCfg.n, delayMs: retryCfg.ms`. Before, the two were swapped.
- `src/retry.js:9` now stops at `attempt === retries`.
- There's a new test that checks `retries: 0` makes exactly one call.

**What it is:** `fetchJson` now runs each GET through a small `withRetry` helper, which retries with exponential backoff. The settings live in `src/config.js` as `{ n: 3, ms: 200 }`. So when the server keeps returning 503, there are 4 calls in total, with waits of 200, 400 and 800 ms before the retries. I checked this with a probe against the head: 4 calls, at 0, 202, 603 and 1404 ms, and then it throws `GET http://x: 503`.

**Findings**
- Earlier P1 on swapped settings (Codex second opinion, `src/client.js:10`): **fixed**.
- Earlier P1 on the wrong call count (Spec reviewer, `src/retry.js:9`): **fixed**. Issue #6 asks for 4 calls with `retries: 3` and 1 call with `retries: 0`, and both now hold.
- On this head, Codex found nothing ("patch is correct") and the Spec reviewer found nothing. The Standards reviewer raised only the naming note again.

**Questions for the author**
- Should a 4xx or a `res.json()` parse failure really be retried too? This is still unanswered from last time.

**Verifier:** not run. The PR touches no authority, data, money or production switch.

**Suggested verdict:** approve. The two P1s are fixed, CI is green, the door is two-way, and the behaviour matches issue #6.

2 style and smell notes; say `what else` to see them.

1 of 1. Waiting for your word: `next`, `approve and post`, `what else`, `try`, or a comment.

## rebase return-visit (d9d071f)

Events in transcript order:

text  INTRO: https://github.com/acme/demo/pull/7 — **Retry failed GET requests** (teammate), 1 of 1. The Guide tab still shows the tour for the earlier h…

The review:

https://github.com/acme/demo/pull/7 — **Retry failed GET requests** (teammate), 1 of 1. The Guide tab still shows the tour for the earlier head, and its content hasn't changed.

**Last time:** you said `approve` at `2287c26` and nothing was posted. The ledger is empty and the PR has no GitHub comments, so there's nothing to mark fixed or answered.

**What changed:** only a rebase. The branch was moved onto `main` at `5e2a95b`, which added one commit, "docs: name the service URL". The patch ID is the same as before (`a95b2f7a`), and `git range-diff` shows both commits unchanged. I didn't rerun the reviewers, so the earlier findings stand.

**Findings, all still open:**
1. **P1** (second opinion), `src/client.js:10`: `retries` and `delayMs` are swapped. As written, a GET retries 200 times, starting with a 3 ms delay that doubles each time.
2. **P1** (spec reviewer), `src/retry.js:9`: the loop stops at `attempt + 1 === retries`. With `retries: 3` it makes 3 calls instead of the 4 the spec asks for, and with `retries: 0` it never stops. A probe confirmed both.
3. **Design** (spec reviewer, P2), `test/retry.test.js:5`: the "tested with `node --test`" claim rests on a test that can't catch #2. Nothing covers `retries: 0` or the call cap.

**CI:** `test` passes. No approvals yet.

**Suggested verdict:** request changes, because of the two P1s. You approved the previous head without posting. If you still want to approve, I'd post it with comments on #1 and #2.

1 style and smell note; say `what else` to see it.

What's your word: `approve`, `next`, `request changes and post`, or a comment?
