# pr-review eval, first visits, at e355e4e

## push first-visit (head e355e4e)

Events in transcript order:

call  Bash cd ~/.agent/pr-review/demo/7; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scripts/a…
call  Bash cd ~/.agent/pr-review/demo/7 && ~/.agents/skills/autoreview/scripts/autoreview --mode branch --base 6c92e250996f0fe9c1cef68b7080f0463e9b8f5f --engine codex --model gpt-6.…
call  Skill code-review
call  t3:orchestrator_capabilities
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:delegate_task model=claude-fable-5-1 mode=wait title="code-review: Standards, PR 7"
  ←   report: ## Standards
call  t3:delegate_task model=claude-fable-5-1 mode=wait title="code-review: Spec, PR 7"
  ←   report: ## Spec
text  INTRO: https://github.com/acme/demo/pull/7 **Retry failed GET requests** by @teammate, closes #6. Before this PR, `f…

The review:

https://github.com/acme/demo/pull/7

**Retry failed GET requests** by @teammate, closes #6. Before this PR, `fetchJson` threw on the first failed GET. Now it wraps the request in a new `withRetry` helper that retries with exponential backoff, using settings in `src/config.js`. The issue asks for this: with the default `retries: 3`, a GET to a failing endpoint makes at most 4 calls, waiting 200 ms, then 400 ms, then 800 ms. `retries: 0` makes exactly one call.

The retry behaviour is backed by tests only, and the one test passes even though both bugs below are present. CI is green and the PR has no approvals yet.

**Tour**

1. [client.js:6-10](<review checkout>/src/client.js:6): **every `fetchJson` failure now retries.** That covers a 404, a 401 and a body that isn't JSON, as well as 5xx and network errors. The policy is a fixed module constant, so callers can't change it per call. **P1, second opinion:** line 10 swaps the settings. `retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3), so a failing GET would retry about 200 times, starting 3 ms apart.
2. [retry.js:9](<review checkout>/src/retry.js:9): **P1, /code-review Spec:** `attempt + 1 === retries` counts total calls, not retries. I ran it: `retries: 3` makes 3 calls where the issue says 4. `retries: 0` never reaches the check and loops forever (176 calls in 200 ms with no delay). The doubling on line 10 is correct.
3. [config.js:1](<review checkout>/src/config.js:1): the names `n` and `ms` don't say which setting is which. That probably caused the swap in stop 1. It's a P2 smell from /code-review Standards.
4. [retry.test.js:5-14](<review checkout>/test/retry.test.js:5): the only test is a call that succeeds on its third try with `retries: 3`, and it passes with the off-by-one. No test covers the call limit, `retries: 0` or `fetchJson` itself (P2, /code-review Spec).

README.md adds one line of docs and has no design in it.

**Findings**
- **P1, second opinion:** settings passed in swapped order ([client.js:10](<review checkout>/src/client.js:10)).
- **P1, /code-review Spec:** one call short of the limit, and endless retries at `retries: 0` ([retry.js:9](<review checkout>/src/retry.js:9)).
- **P2, /code-review Spec:** the tests can't catch either bug.

**Questions for the author**
- Should 4xx responses and JSON parse errors retry, or only network errors and 5xx?

**Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.

**Suggested verdict: request changes.** Each P1 alone breaks the retry limit the issue asks for.

1 style and smell note; say `what else` to see it.

PR 1 of 1. Say `next`, `post`, `request changes and post`, `try`, or add comments. Nothing has been posted to GitHub.

## rebase first-visit (head e355e4e)

Events in transcript order:

call  Bash H=/var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-rebase-SB7K0w/home/.agent/pr-review/demo/7 for p in $H/.agents/skills/autoreview/scripts/autoreview $H/.…
call  t3:orchestrator_capabilities
call  Bash cd /var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-rebase-SB7K0w/home/.agent/pr-review/demo/7 && /var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-revie…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:task_status
  ←   report: ## Standards
call  t3:task_status
  ←   report: ## Spec
text  INTRO: **PR 1 of 1:** https://github.com/acme/demo/pull/7 This PR makes `fetchJson` retry a failed GET with exponent…

The review:

**PR 1 of 1:** https://github.com/acme/demo/pull/7

This PR makes `fetchJson` retry a failed GET with exponential backoff, which is what issue #6 asks for. Per the issue, if the demo service keeps returning 503, a call should be tried 4 times: the first try plus 3 retries, waiting 200, 400 and 800 ms between them. As written, it would be tried **200 times**, with waits starting at 3 ms and doubling each time.

CI is green, but the only test calls `withRetry` directly with hand-picked numbers, so neither bug below shows up in the tests. Door: two-way.

**Tour.** No design change: it adds one helper and one config object, and nothing else depends on them.

1. [client.js:7-11](<review checkout>/src/client.js:7): the request is wrapped in `withRetry`. **P1, second opinion:** the two settings are passed into each other's slots at line 10. `retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3).
2. [retry.js:9](<review checkout>/src/retry.js:9): the stop condition `attempt + 1 === retries` treats `retries` as the total number of calls. **P1, Spec reviewer:** with `retries: 3` it makes 3 calls, but the issue says 4. With `retries: 0` the check is never true, so a failing GET retries forever, where the issue says exactly one call. The doubling at line 10 is correct.
3. [config.js:1](<review checkout>/src/config.js:1): `{ n: 3, ms: 200 }`. The Standards reviewer flagged the names `n` and `ms` as unclear (P2, style). Naming them `retries` and `delayMs`, to match `withRetry`, would have made the swap in stop 1 obvious.
4. [retry.test.js:5](<review checkout>/test/retry.test.js:5): **P2, Spec reviewer:** this is the only test. It passes even with the off-by-one, and it never runs `fetchJson`, so it can't catch the swap either. A test for `retries: 0`, one for the call limit, and one through `fetchJson` would cover both P1s.

The README gets one line of docs and carries no design.

**Findings**
- **P1, second opinion:** the settings are swapped, so a failing GET makes 200 attempts. [client.js:10](<review checkout>/src/client.js:10)
- **P1, Spec reviewer:** the call count is off by one, and `retries: 0` loops forever. [retry.js:9](<review checkout>/src/retry.js:9)
- **P2, Spec reviewer:** the PR says "Tested with `node --test`", but the test doesn't exercise either acceptance criterion.

I checked each finding against the code at the head, and all three hold.

**Question for the author:** every error is retried, including 4xx responses and JSON parse failures (`client.js:8-10`). Was that intended, or should it retry only 5xx and network errors?

**Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.

**Suggested verdict: request changes.** There are two P1s, and together they mean the shipped behaviour doesn't match the issue in any case.

There is 1 style and smell note (the config names above); say `what else` to see it. The prep record is at `~/.agent/pr-review/demo/7.md`. Nothing has been posted to GitHub.

Your word: `next`, "request changes and post", `try`, a comment, or `stop`.
