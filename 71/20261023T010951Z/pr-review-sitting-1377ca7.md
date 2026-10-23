# pr-review eval, the sitting chain, 1377ca7

PR #7 and a smaller layer #5 stacked on it both wait on the user's review. Each turn is a live headless Claude Code run with gh, T3's MCP server and the autoreview helper faked at the outer boundary.

## Turn: `bare /pr-review`

Events in transcript order:

```text
call  Bash node <eval>/config/skills/pr-review/scripts/queue.mjs
  ←   queue: acme/demo#7 (size 41, stackBottom true, unblocks 1), acme/demo#5 (size 10, stackBottom false, unblocks 0)
text  Two PRs. Pinning #7 and checking for existing prep records.
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=none guide=null
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=none guide=null
call  t3:write_pull_request_guides [{"repository":"acme/demo","number":7},{"repository":"acme/demo","number":5}]
text  Guides started for both. Now the reviewers for #7: loading `/code-review` and resolving autoreview p…
call  Bash cd $HOME/.agent/pr-review/demo/7 && git rev-parse refs/pr-review/7-base && git log refs/pr-review/7-base..HEAD --oneline && git diff refs/pr…
call  Bash cd $HOME/.agent/pr-review/demo/7 && "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base b5f4cc96c42e30fe53960220df1986…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
call  Bash cat $HOME/.agent/pr-review/demo/7.autoreview.log
  ←   second opinion: autoreview findings: 1
  ←   report: ## Standards
  ←   report: ## Spec
call  Bash cd $HOME/.agent/pr-review/demo/7 && pid=$(git diff refs/pr-review/7-base...refs/pr-review/7-head | git patch-id --stable | cut -d' ' -f1) &&…
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=Running guide=null
call  t3:delegate_task model=claude-opus-5-5 mode=async title="Background prep: acme/demo#5"
text  Guide for #7 is still running; waiting a minute before checking again.
call  t3:read_pull_request_guide 7
  ←   #7 guide: run=Completed guide=written for a48bcfd
text  Your review queue has 2 PRs: | # | PR | Title | Author | Size | Visit / stack | |---|---|---|---|--…
```

Every message the agent sent, in order:

> Two PRs. Pinning #7 and checking for existing prep records.

---

> Guides started for both. Now the reviewers for #7: loading `/code-review` and resolving autoreview per apr step 1.

---

> Guide for #7 is still running; waiting a minute before checking again.

---

> Your review queue has 2 PRs:
> 
> | # | PR | Title | Author | Size | Visit / stack |
> |---|---|---|---|---|---|
> | 1 | acme/demo#7 | Retry failed GET requests | teammate | +38/−3, 5 files | First visit, stack bottom (#5 sits on it) |
> | 2 | acme/demo#5 | Log each retry | teammate | 10 lines, 3 files | First visit, sits on #7 |
> 
> ---
> 
> **1 of 2: https://github.com/acme/demo/pull/7**
> 
> The tour is in the PR panel's Guide tab.
> 
> This PR makes `fetchJson` retry a failed GET with exponential backoff. It wraps the call in a new `withRetry` helper (`src/retry.js`), and the settings live in `src/config.js` as `retryCfg = { n: 3, ms: 200 }`. Issue #6 asks for the first retry after 200 ms, up to 3 retries (so at most 4 calls), and exactly one call when `retries: 0`.
> 
> CI is green, but it runs one test: a call that succeeds on its third try. That test passes with both bugs below.
> 
> **Findings**
> - **P1, second opinion:** `src/client.js:10` swaps the settings. `retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3). A failing GET is retried 200 times, starting 3 ms apart and doubling each time, so in practice it never gives up. I checked this against the code.
> - **P1, Spec:** `src/retry.js:9`. `attempt + 1 === retries` counts total calls, not retries, so `retries: 3` makes 3 calls instead of 4. With `retries: 0` the check is never true, so a failing call retries forever. This breaks the issue's "`retries: 0` makes exactly one call".
> 
> Neither finding was wrong once checked against the code.
> 
> **Questions for the author**
> - None beyond the fixes. The Standards reviewer traces the swap to the names `n` and `ms` (see the notes below).
> 
> **Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.
> 
> **Suggested verdict: request changes.** There are two P1s, and together they turn every failing GET into an endless retry loop.
> 
> 2 style and smell notes (no test for `retries: 0` or the call limit; `retryCfg.n`/`.ms` are unclear names). Say `what else` to see them.
> 
> Background prep for #5 is running. Your word: `next`, `post` / `request changes and post`, `what else`, `verify`, `try`, a comment, or `stop`.

## Turn: `next`

Events in transcript order:

```text
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=Running guide=null
text  The prep record for #5 matches its head and patch ID. Its guide is still being written, so I'll chec…
call  t3:read_pull_request_guide 5
  ←   #5 guide: run=Completed guide=written for 1d0d691
text  **2 of 2: https://github.com/acme/demo/pull/5** The tour is in the PR panel's Guide tab. This PR s…
```

Every message the agent sent, in order:

> The prep record for #5 matches its head and patch ID. Its guide is still being written, so I'll check again in a minute.

---

> **2 of 2: https://github.com/acme/demo/pull/5**
> 
> The tour is in the PR panel's Guide tab.
> 
> This PR sits on #7. It writes one warning line each time a GET is retried, so a flaky dependency shows up in the logs. `withRetry` gets an optional `onRetry(err, attempt)` hook, which it calls before each wait (`src/retry.js:10`). `fetchJson` passes `logRetry(url)`, which logs a line like `retry 1 of GET https://api.demo/items: GET https://api.demo/items: 503`. CI is green. No issue backs this PR, so the Spec reviewer checked it against the PR body.
> 
> **Findings**
> - **P1, second opinion, which I think is wrong:** `src/log.js:3`, `logRetry`. It logs the full URL with its query string, so a `?token=` would land in the logs. Nothing in this repo puts a credential in a URL, and #7 already puts the URL in every error message (`src/client.js:9`). This PR adds no new leak, and I'd raise it as a question rather than block on it.
> - **Inherited from #7:** `src/client.js:11` still passes the swapped `retries`/`delayMs`. Until #7 is fixed, a failing GET writes up to 199 warning lines.
> 
> **Questions for the author**
> - Should URLs be redacted in logs and errors? If so, that belongs in #7's error message too.
> - The URL appears twice in each line, because `err.message` already contains it. Is that intended?
> 
> **Verifier:** not run. Logging isn't authority, data, money or a production switch.
> 
> **Suggested verdict: approve.** The change is small and correct on its own. Its real problems come from #7, so land it after #7's fixes.
> 
> No style or smell notes.
> 
> That was the last PR in the queue. Your word on #5: `next`/`approve`, `post` / `approve and post`, a comment, `try`, or `stop` for the report.
