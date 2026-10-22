# pr-review eval, first visits, ff7db7d

## push first-visit (ff7db7d)

Events in transcript order:

call  Bash cd ~/.agent/pr-review/demo/7; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scripts/a…
call  t3:orchestrator_capabilities
call  Bash cat /var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-push-sf2kbm/config/skills/code-review/SKILL.md | head -80; ~/.agents/skills/autoreview/scripts/autorev…
call  Bash cd ~/.agent/pr-review/demo/7 && ~/.agents/skills/autoreview/scripts/autoreview --mode branch --base a34735b37e6b0a677344b563f8bfa417a72c77ef --engine codex --model gpt-6.…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:task_status
  ←   report: ## Standards
call  t3:task_status
  ←   report: ## Spec
text  INTRO: https://github.com/acme/demo/pull/7 **What it is.** @teammate's PR closes #6. `fetchJson` now runs its GET inside a new `withRetry` helper,…

The review:

https://github.com/acme/demo/pull/7

**What it is.** @teammate's PR closes #6. `fetchJson` now runs its GET inside a new `withRetry` helper, which retries with exponential backoff, and the retry settings live in `src/config.js`. Here is what the issue asks for: when the demo service returns a 503, `fetchJson` waits 200 ms and tries again, then 400 ms, then 800 ms, so it makes at most 4 calls. `retries: 0` should make exactly one call.

**Tests only:** CI is green, but its one test only covers `withRetry` succeeding on its third call. Nothing tests `fetchJson`, the call limit or `retries: 0`, and that is where both bugs below are.

**Tour.** There's no design change here. It's a local helper, the door is two-way, and nothing outside `fetchJson` depends on it.

1. [client.js:10](<review checkout>/src/client.js:10): **P1, second opinion.** The arguments are swapped: `retries: retryCfg.ms, delayMs: retryCfg.n`. A failing GET gets 200 attempts, starting 3 ms apart and doubling each time, so the caller effectively hangs.
2. [retry.js:9](<review checkout>/src/retry.js:9): **P1, code-review Spec.** `attempt + 1 === retries` treats `retries` as the total number of calls. So `retries: 3` makes 3 calls instead of 4. With `retries: 0` the check is never true, and the loop retries forever. Changing it to `attempt >= retries` fixes both cases.
3. [retry.js:3](<review checkout>/src/retry.js:3): the backoff (`delayMs * 2 ** attempt`) does match the "doubles" criterion.
4. [config.js:1](<review checkout>/src/config.js:1): the values `{ n: 3, ms: 200 }` are right. Their unclear names (code-review Standards, P2) are what made the swap in stop 1 easy.
5. [retry.test.js:5](<review checkout>/test/retry.test.js:5): **P2, code-review Spec.** The only test passes even with both bugs. It needs cases for "always fails → 4 calls" and "`retries: 0` → 1 call", plus one through `fetchJson`.

The README gets one line of docs that adds nothing to review.

**Findings**
- P1, second opinion: the retry settings are swapped at [client.js:10](<review checkout>/src/client.js:10).
- P1, code-review Spec: off by one, and `retries: 0` loops forever, at [retry.js:9](<review checkout>/src/retry.js:9).
- P2, code-review Spec: the tests don't cover the issue's acceptance criteria.

**Question for the author.** `withRetry` retries every error, including a 404 or a JSON parse failure. Should it retry only network errors and 5xx responses? The issue says "a failed GET" and doesn't settle it.

**Verifier.** Not run, because the PR doesn't touch authority, data, money or a production switch.

**Suggested verdict: request changes.** Two P1s: as merged, a failing GET either hangs or retries forever.

There's 1 style and smell note; say `what else` to see it.

PR 1 of 1. Nothing has been posted. Tell me `next`, `post` / `request changes and post` (I'll show you the draft first), `try`, or add comments.

## rebase first-visit (ff7db7d)

Events in transcript order:

call  t3:orchestrator_capabilities
call  Bash cd ~/.agent/pr-review/demo/7; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scripts/a…
call  Bash cd ~/.agent/pr-review/demo/7 && "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base 05df57ca008ac4f708813f38baccb8c8f6616db8 --engine codex --model …
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:task_status
call  t3:task_status
  ←   report: ## Standards
  ←   report: ## Spec
text  INTRO: **PR 7 of 1:** https://github.com/acme/demo/pull/7 teammate's PR closes #6. When a GET fails, `fetchJson` should now retry it, waiting 200 …

The review:

**PR 7 of 1:** https://github.com/acme/demo/pull/7

teammate's PR closes #6. When a GET fails, `fetchJson` should now retry it, waiting 200 ms before the first retry and doubling the wait each time. All retrying goes through a new `withRetry(fn, { retries, delayMs })` helper, and `retryCfg = { n: 3, ms: 200 }` in `src/config.js` sets the count and the delay. For example, a GET that returns 503 every time should be tried 4 times, with waits of 200, 400 and 800 ms, and then throw.

The body says "Tested with `node --test`", but the PR's one test passes even with both bugs below. CI is green. There is a `**Door:**` line (two-way) and no approvals yet.

**Tour.** The PR changes no design. It only adds behaviour inside `fetchJson`, so the tour follows the call path.

1. [client.js:6-10](<review checkout>/src/client.js:6): `fetchJson` wraps the old fetch, status check and JSON parse in `withRetry`. **P1, second opinion:** line 10 passes the settings the wrong way round. `retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3), so a failing GET retries about 200 times, with the wait doubling from 3 ms.
2. [retry.js:4-12](<review checkout>/src/retry.js:9): the loop. **P1, code-review Spec:** the stop check `attempt + 1 === retries` on line 9 is off by one. I confirmed with a probe: `retries: 3` makes 3 calls instead of 4, and `retries: 0` never matches, so the loop never ends. Both break acceptance criteria in #6.
3. [config.js:1](<review checkout>/src/config.js:1): `{ n, ms }`. **P2, code-review Standards:** the names don't say which field is the count and which is the delay, which is probably how stop 1 happened. Naming them `retries` and `delayMs` would let `client.js` pass `retryCfg` as it is.
4. [retry.test.js:5](<review checkout>/test/retry.test.js:5): **P2, code-review Spec:** the only test is a call that succeeds on its 3rd try. Nothing tests `retries: 0`, the call limit, the delays or `fetchJson` itself.

The other changed file, `README.md`, is a one-line doc note.

**Findings**
- **P1** (second opinion): `retries` and `delayMs` are swapped, [client.js:10](<review checkout>/src/client.js:10).
- **P1** (code-review Spec): off by one, and `retries: 0` loops forever, [retry.js:9](<review checkout>/src/retry.js:9). The fix is `if (attempt >= retries) throw err;`.

**Questions for the author:** Should the retry apply only to 5xx and network errors? At the moment a 404 is also retried. #6 doesn't say.

**Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.

**Suggested verdict:** request changes. There are two P1s, and together they turn every failing GET into a long loop of retries.

2 style and smell notes (the naming and the test gap above); say `what else` for detail.

Next: `next`, `request changes and post`, `verify`, `try`, or add a comment.
