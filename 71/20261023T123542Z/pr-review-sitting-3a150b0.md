# pr-review eval, the sitting chain, 3a150b0

PR #7 and a smaller layer #5 stacked on it both wait on the user's review. Each turn is a live headless Claude Code run with gh, T3's MCP server and the autoreview helper faked at the outer boundary.

## Turn: `/pr-review queue`

Events in transcript order:

```text
call  Bash node <eval>/config/skills/pr-review/scripts/queue.mjs --repo acme/demo
  ←   queue: acme/demo#7 (size 41, stackBottom true, unblocks 1), acme/demo#5 (size 10, stackBottom false, unblocks 0)
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=none guide=null
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=none guide=null
call  t3:write_pull_request_guides [{"repository":"acme/demo","number":7},{"repository":"acme/demo","number":5}]
call  Bash for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HOME/skills/autoreview/scripts/a…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
call  Bash cd ~/.agent/pr-review/demo/7 && <eval>/home/.agents/skills/autoreview/…
call  t3:delegate_task model=claude-opus-5-5 mode=async title="Background prep: PR 5"
call  Bash cat ~/.agent/pr-review/demo/7.autoreview.log; gh issue view 6 --repo acme/demo --json title,body
  ←   second opinion: autoreview findings: 1
  ←   report: ## Standards
  ←   report: ## Spec
text  Both reviewers on #7 are back, and the code confirms all three of their main findings. Checking the …
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=Running guide=null
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=Completed guide=written for 688624a
text  **Review queue for acme/demo** | # | PR | Title | Author | Size | Note | |---|---|---|---|---|---| …
```

Every message the agent sent, in order:

> Both reviewers on #7 are back, and the code confirms all three of their main findings. Checking the guide now.

---

> **Review queue for acme/demo**
> 
> | # | PR | Title | Author | Size | Note |
> |---|---|---|---|---|---|
> | 1 | acme/demo#7 | Retry failed GET requests | teammate | 41 lines, 5 files | Bottom of a stack; #5 sits on it |
> | 2 | acme/demo#5 | Log each retry | teammate | 10 lines, 3 files | Sits on #7 |
> 
> ---
> 
> ### 1 of 2: https://github.com/acme/demo/pull/7
> 
> The tour is in the PR panel's Guide tab.
> 
> This PR wraps `fetchJson` in a new `withRetry` helper so that a failed GET is tried again with exponential backoff. The settings live in `src/config.js` as `retryCfg = { n: 3, ms: 200 }`. Issue #6 asks for a 200 ms wait before the first retry and 3 retries by default, so a GET makes at most 4 calls. It also says `retries: 0` should make exactly one call.
> 
> The behaviour is backed by tests only. CI is green, but the one test calls `withRetry` directly and nothing tests `fetchJson`.
> 
> **Findings**
> - **P1, second opinion:** `src/client.js:10` swaps the two settings: `retries: retryCfg.ms, delayMs: retryCfg.n`. A failing GET is tried 200 times, starting 3 ms apart and doubling each time, so in practice it never gives up. I checked this against the code.
> - **P1, Spec:** `src/retry.js:9`, `attempt + 1 === retries`, stops one call early: `retries: 3` makes 3 calls where the issue wants 4. With `retries: 0` the check is never true, so a failing GET retries forever. Both break acceptance criteria in #6.
> 
> **Questions for the author**
> - Should a 4xx response such as a 404 be retried? Right now every response that isn't ok is retried.
> 
> **Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.
> 
> **Suggested verdict:** request changes. There are two P1s: the swapped settings make a failing GET hang, and the loop's stop condition doesn't match the issue.
> 
> 2 style and smell notes (the test gaps and the `n`/`ms` names); say `what else` to see them.
> 
> Background prep for #5 is already running. Say `next`, `post`, `request changes and post`, or add a comment.

## Turn: `next`

Events in transcript order:

```text
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=Running guide=null
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=Completed guide=written for 6bb5467
text  I recorded #7 as `next`: nothing was posted and its `seen` ref now points at the head you reviewed. …
```

Every message the agent sent, in order:

> I recorded #7 as `next`: nothing was posted and its `seen` ref now points at the head you reviewed. Background prep for #5 had finished, with both reviewers reporting. I checked its draft against the diff myself.
> 
> ### 2 of 2: https://github.com/acme/demo/pull/5
> 
> The tour is in the PR panel's Guide tab.
> 
> This PR sits on #7 and adds a warning line each time a GET is retried, so a flaky dependency shows up in the logs. `withRetry` takes a new `onRetry` callback and calls it before each wait. `fetchJson` passes it `logRetry(url)`, which prints something like `retry 1 of GET https://api.example/items?token=abc: GET https://api.example/items?token=abc: 503`.
> 
> The log line has no test at all. CI is green, but only because #7's single test still passes.
> 
> **Findings**
> - **P1, second opinion:** `src/log.js:3`, `logRetry`, logs the full URL, query string included, so a `?token=` lands in the logs on every retry. I checked this against the code. The URL actually appears twice per line, because `err.message` from `src/client.js:9` (a line from #7) already contains it. So the thrown error leaks it too, which predates this PR.
> - **Inherited from #7, not new:** while #7's settings stay swapped, a failing GET would now print up to 199 warning lines. Fixing #7 fixes this.
> 
> **Questions for the author**
> - Should the log strip the query string, or log only the host and path? And should #7's error message do the same?
> 
> **Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.
> 
> **Suggested verdict:** request changes, for the P1 URL leak. It also shouldn't merge before #7's P1s are fixed.
> 
> No style or smell notes.
> 
> Say `next` to finish the sitting, `post` / `request changes and post`, or add a comment.
