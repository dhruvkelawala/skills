# pr-review eval, guides off, 8079158

## off first-visit (8079158)

Events in transcript order:

call  t3:read_pull_request_guide
  ←   guide: run=none guide=null stale=false head=c9386f2
call  t3:write_pull_request_guides [{"url":"https://github.com/acme/demo/pull/7"}]
  ←   error: Review guides are off on this server.
call  Bash cd "$HOME/.agent/pr-review/demo/7"; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scr…
call  Skill code-review
call  Bash cd "$HOME/.agent/pr-review/demo/7" && "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base 0e749254b74ba8425eb3a7c152ed397dcd317b11 --engine codex --…
call  Bash cat /tmp/pr7-autoreview.log
call  t3:orchestrator_capabilities
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
call  t3:task_status
call  t3:task_status
  ←   report: ## Standards
  ←   report: ## Spec
text  INTRO: https://github.com/acme/demo/pull/7 Review guides are off on this server, so the tour is below instead of in the Guide tab. **What it is.*…

The review:

https://github.com/acme/demo/pull/7

Review guides are off on this server, so the tour is below instead of in the Guide tab.

**What it is.** This is teammate's PR for issue #6. `fetchJson` now runs its GET inside a new `withRetry` helper, and the retry settings live in `retryCfg` in `src/config.js`. Issue #6 asks for 3 retries after the first failure (at most 4 calls), a 200 ms wait before the first retry that doubles each time, and exactly one call when `retries: 0`. What the PR actually does with `{ n: 3, ms: 200 }`: a failing GET is tried 200 times, starting 3 ms apart.

**What the tests cover.** The one test drives `withRetry` with hand-picked options. It never touches `fetchJson`, which is why the swapped settings got through. CI is green.

**Tour.** There's no design change beyond one new helper and its config.

1. `src/client.js:10`, `fetchJson`: the options are passed as `retries: retryCfg.ms, delayMs: retryCfg.n`. **P1, second opinion:** the two settings are swapped.
2. `src/retry.js:9`, `withRetry`: the check `attempt + 1 === retries` is meant to stop the loop. **P1, Spec:** `retries: 3` makes 3 calls instead of 4. `retries: 0` never matches, so the loop never ends. I ran it: 233 calls in 300 ms.
3. `src/config.js:1`, `retryCfg`: **P2, Standards:** the names `n` and `ms` don't say which is the count and which is the delay. That ambiguity likely caused stop 1.
4. `test/retry.test.js:5`, "retries until the call succeeds": **P2, Spec:** nothing tests `retries: 0`, the call limit, or the `fetchJson` wiring. The test passes despite both P1s.

The README line about retries is accurate.

**Findings**
- **P1, second opinion:** `src/client.js:10`, the swapped options.
- **P1, Spec:** `src/retry.js:9`, one call short, and an endless loop at `retries: 0`.

**Question for the author**
- Should a 4xx retry? Right now every non-OK status does, so a 404 is fetched 4 times.

**Verifier:** not run, because the PR doesn't touch authority, data, money or a production switch.

**Suggested verdict:** request changes, for the two P1 bugs. One makes failing GETs effectively hang. The other breaks the issue's acceptance criteria.

No other style or smell notes beyond stop 3.

1 of 1. Your word: `next`, `post` / `request changes and post`, a comment, `try`, or `stop`. Nothing has been posted.
