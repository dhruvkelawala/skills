# pr-review eval, guides off, 1e64b14

## off first-visit (1e64b14)

Events in transcript order:

call  t3:read_pull_request_guide
  ←   guide: run=none guide=null stale=false head=998eaaa
call  t3:write_pull_request_guides [{"url":"https://github.com/acme/demo/pull/7"}]
  ←   error: Review guides are off on this server.
call  Bash cd "$HOME/.agent/pr-review/work/7"; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scr…
call  Skill code-review
call  Bash "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base 269b6445b5d08855a3d3ca748e4b9cdc842b0ef7 --engine codex --model gpt-6.1-sol --thinking xhigh > /…
call  Bash cat /tmp/pr7-autoreview.log
  ←   second opinion: autoreview findings: 1, overall: patch is incorrect (0.90)
call  t3:orchestrator_capabilities
call  t3:delegate_task model=claude-fable-5-1 mode=wait title="PR 7 Standards review"
  ←   report: ## Standards
call  t3:delegate_task model=claude-fable-5-1 mode=wait title="PR 7 Spec review"
  ←   report: ## Spec
text  INTRO: https://github.com/acme/demo/pull/7 **No Guide tab this time.** T3 refused to write the guide because review guides are switched off on thi…

The review:

https://github.com/acme/demo/pull/7

**No Guide tab this time.** T3 refused to write the guide because review guides are switched off on this server. A short tour is below.

**What it is.** This PR is teammate's fix for #6: `fetchJson` should retry a failed GET with exponential backoff. The issue asks for 3 retries after the first failure (at most 4 calls), a 200 ms wait before the first retry that doubles each time, and exactly one call with `retries: 0`. The PR adds a `withRetry` helper and a `retryCfg = { n: 3, ms: 200 }` setting, and wraps `fetchJson` in the helper.

**The claim is backed by tests only.** CI is green, but its one test passes even with both bugs below.

**Tour:** `src/config.js` (the settings) → `src/client.js:10` (where they're passed in) → `src/retry.js:9` (when to stop) → `test/retry.test.js`.

**Findings**
- **P1** (second opinion, `src/client.js:10`): The two settings are passed in swapped: `retries: retryCfg.ms, delayMs: retryCfg.n`. So a failing GET is tried 200 times, starting 3 ms apart and doubling each time. I confirmed this in the code.
- **P1** (Spec, `src/retry.js:9`): `attempt + 1 === retries` gives up one call early, and with `retries: 0` it never gives up. I ran it with a call that always fails: `retries: 3` made 3 calls (the issue says 4), and `retries: 0` made 258 calls in 300 ms before I stopped it.
- **Design, P2** (Spec, `test/retry.test.js:5`): Neither bug is tested. Nothing covers `retries: 0` or the call limit, and nothing tests `fetchJson` itself.

**Question for the author**
- Every error is retried, including 404s and JSON parse errors. Is that intended, or should it retry only network errors and 5xx?

**Verifier:** I didn't run it. The PR touches no authority, data, money or production switch.

**Suggested verdict: request changes.** There are two confirmed P1s, and together they make a failing GET retry about 200 times instead of 3.

1 style and smell note; say `what else` to see it.

1 of 1. Nothing is posted. Say `next`/`approve`, "request changes and post", `what else`, `try`, or add comments.
