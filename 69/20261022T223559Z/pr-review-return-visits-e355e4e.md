# pr-review eval, return visits, at e355e4e

## push return-visit (head e355e4e)

Events in transcript order:

call  t3:orchestrator_capabilities
call  Bash for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scripts/autoreview" ~/.agents/skills/au…
call  Bash cd ~/.agent/pr-review/demo/7 && /var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-push-kriH7f/home/.agents/skills/autoreview/scripts/autoreview --mode branc…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
  ←   second opinion: autoreview findings: 0, overall: patch is correct (0.90)
call  t3:task_status
  ←   report: ## Standards
call  t3:task_status
  ←   report: ## Spec
text  INTRO: https://github.com/acme/demo/pull/7 **Return visit (1 of 1).** You last saw `1fadf9e` and said "approve" with…

The review:

https://github.com/acme/demo/pull/7

**Return visit (1 of 1).** You last saw `1fadf9e` and said "approve" without posting it. Two P1s were open at that point. You left no comments in chat or on GitHub, so nothing from you is waiting on a reply.

The PR makes `fetchJson` retry a failed GET with exponential backoff (issue #6). With the defaults `{ n: 3, ms: 200 }`, a GET that keeps failing is called 4 times, with waits of 200, 400 and 800 ms between calls. The author pushed one new commit, `7d8249d fix: retry count and the order of the retry settings`. This is a real change, not a rebase, so both reviewers ran again on the whole PR.

**Tour (what changed since `1fadf9e`).** This commit changes no design.

1. [client.js:10](<review checkout>/src/client.js:10): `retries` now reads `retryCfg.n` and `delayMs` reads `retryCfg.ms`. **Earlier P1 (second opinion) is fixed.** Before this, the two were swapped, so a request retried 200 times starting at 3 ms.
2. [retry.js:9](<review checkout>/src/retry.js:9): the loop now stops when `attempt === retries`. **Earlier P1 (code-review Spec) is fixed.** I ran it: `retries: 3` makes 4 calls with doubling delays, and `retries: 0` makes 1 call.
3. [retry.test.js:16-23](<review checkout>/test/retry.test.js:16): a new test checks that `retries: 0` makes exactly one call. **Earlier P2 test gap is only partly fixed.** No test checks the 4-call cap, and no test goes through `fetchJson`, which is where the swap bug was.
4. [config.js:1](<review checkout>/src/config.js:1): this file didn't change, so **the P2 Mysterious Name note (code-review Standards) is still open.** The names `n` and `ms` are probably what made the swap easy to write.

**Wrap-up**

1. **Findings:** no P0 or P1 findings remain. The second opinion (codex gpt-6.1-sol) found nothing and called the patch correct (0.90). The Spec reviewer found nothing. CI `test` passes, and `node --test` passes 2 of 2 locally.
2. **Question for the author:** would they rename `retryCfg` to `{ retries, delayMs }` and add a test through `fetchJson` that fails 4 times? Neither is blocking.
3. **Verifier:** not run, because the PR touches no authority, data, money or production switch.
4. **Suggested verdict:** approve. Both P1s are fixed, and I checked the fix by running it. You could add a non-blocking nit about the names and the `fetchJson` test.
5. That leaves 2 style and smell notes: the names and the test gap. Both are above, so `what else` has nothing new.

I updated the prep record to `7d8249d`. Say `next` or `approve` to record your decision, or "approve and post" and I'll show you a draft review before posting it.

## rebase return-visit (head e355e4e)

Events in transcript order:

text  INTRO: https://github.com/acme/demo/pull/7 **PR #7, "Retry failed GET requests", by teammate.** This is a return vis…

The review:

https://github.com/acme/demo/pull/7

**PR #7, "Retry failed GET requests", by teammate.** This is a return visit. You last saw the PR at `9ec8b8a` and approved it without posting. It now sits at `b10810b`.

**Your earlier comments:** 0 of 3 open findings are fixed or answered. Nothing is on GitHub: no reviews, no comments, no threads. The open findings are [client.js:10](<review checkout>/src/client.js:10), [retry.js:9](<review checkout>/src/retry.js:9) and [retry.test.js:5](<review checkout>/test/retry.test.js:5).

**Tour:** this is a pure rebase. The branch moved onto main `b6c9135` ("docs: name the service URL"), and the patch ID is unchanged (`a95b2f7`). I didn't rerun the two reviewers, so last visit's findings still apply. CI `test` passes.

**Wrap-up**

1. **Findings**, all still open:
   - [client.js:10](<review checkout>/src/client.js:10): **P1, second opinion.** `retries: retryCfg.ms, delayMs: retryCfg.n` has the two values swapped. A failing GET makes 200 attempts, starting with a 3 ms delay.
   - [retry.js:9](<review checkout>/src/retry.js:9): **P1, code-review Spec.** `attempt + 1 === retries` counts total calls, not retries. `retries: 3` gives 3 calls where #6 asks for 4, and `retries: 0` never stops.
   - [retry.test.js:5](<review checkout>/test/retry.test.js:5): **P2 design, code-review Spec.** The test only calls `withRetry` directly and never checks the call limit, so it passes despite both P1s.
2. **Question for the author:** [client.js:7-11](<review checkout>/src/client.js:7) retries every error, including 4xx responses and JSON parse failures. Is that intended?
3. **Verifier:** not run. The PR touches no authority, data, money or production switch.
4. **Suggested verdict: request changes.** The two P1s mean a failing GET retries about 200 times instead of 4. The rebase didn't change that. Your earlier approval was never posted, so nothing on GitHub needs retracting.
5. There is 1 style and smell note; say `what else` to see it.

I updated the prep record to `b10810b`. The `seen` ref stays at `9ec8b8a` until you give your word.

1 of 1. Say `next`, `post`, `request changes and post`, or add a comment.
