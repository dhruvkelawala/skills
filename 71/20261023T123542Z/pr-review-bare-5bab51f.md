# pr-review eval, the bare chain, 5bab51f (the skill before this change)

PR #7 and a smaller layer #5 stacked on it both wait on the user's review. Each turn is a live headless Claude Code run with gh, T3's MCP server and the autoreview helper faked at the outer boundary.

## Turn: `/pr-review`

Events in transcript order:

```text
call  Bash node /var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-bare-KDpWuE/config/skills/pr-review/scripts/queue.mjs
  ←   queue: acme/demo#7 (size 41, stackBottom true, unblocks 1), acme/demo#5 (size 10, stackBottom false, unblocks 0)
text  Two PRs. Pinning #7 first.
call  t3:read_pull_request_guide https://github.com/acme/demo/pull/7
  ←   #7 guide: run=none guide=null
call  t3:read_pull_request_guide https://github.com/acme/demo/pull/5
  ←   #5 guide: run=none guide=null
call  t3:write_pull_request_guides [{"url":"https://github.com/acme/demo/pull/7"},{"url":"https://github.com/acme/demo/pull/5"}]
call  Bash cd ~/.agent/pr-review/demo/7; for p in .agents/skills/autoreview/scripts/autoreview .claude/skills/autoreview/scripts/autoreview "$AGENTS_HO…
call  Bash cd ~/.agent/pr-review/demo/7 && "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base ba172fd2e978026ef2315ba9fe0bfc64df…
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Standards review"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="PR 7 Spec review"
call  Bash cat ~/.agent/pr-review/demo/7.autoreview.log
  ←   second opinion: autoreview findings: 1
text  While the Standards and Spec reviewers run, I'm handing PR #5's prep to a background child.
call  t3:delegate_task model=claude-opus-5-5 mode=async title="Background prep for acme/demo#5"
text  Let me confirm the `retries: 0` behaviour directly.
text  The probe never stopped, because with `retries: 0` my own cap error gets retried too. That confirms …
text  Confirmed: `retries: 3` makes 3 calls where the spec asks for 4, and `retries: 0` loops forever. Now…
  ←   report: ## Standards
  ←   report: ## Spec
call  t3:read_pull_request_guide https://github.com/acme/demo/pull/7
  ←   #7 guide: run=Running guide=null
text  All three reviewers are back, and each finding holds up against the code. I'm writing the prep recor…
call  t3:read_pull_request_guide https://github.com/acme/demo/pull/7
  ←   #7 guide: run=Completed guide=written for fdcd8cb
text  Two PRs are waiting on your review. Both are teammate's, and #5 is stacked on #7. | # | PR | Title …
```

Every message the agent sent, in order:

> Two PRs. Pinning #7 first.

---

> While the Standards and Spec reviewers run, I'm handing PR #5's prep to a background child.

---

> Let me confirm the `retries: 0` behaviour directly.

---

> The probe never stopped, because with `retries: 0` my own cap error gets retried too. That confirms the endless loop. Stopping it.

---

> Confirmed: `retries: 3` makes 3 calls where the spec asks for 4, and `retries: 0` loops forever. Now checking on the reviewers.

---

> All three reviewers are back, and each finding holds up against the code. I'm writing the prep record while the guide finishes.

---

> Two PRs are waiting on your review. Both are teammate's, and #5 is stacked on #7.
> 
> | # | PR | Title | Author | Size | Note |
> | --- | --- | --- | --- | --- | --- |
> | 1 | acme/demo#7 | Retry failed GET requests | teammate | 41 lines, 5 files | Bottom of the stack, unblocks #5 |
> | 2 | acme/demo#5 | Log each retry | teammate | 10 lines, 3 files | Sits on #7 |
> 
> ## 1 of 2: https://github.com/acme/demo/pull/7
> 
> The tour is in the PR panel's Guide tab.
> 
> When a GET to the demo service fails, `fetchJson` now tries it again, waiting longer each time. Issue #6 asks for 3 retries by default, so at most 4 calls, with a 200 ms wait that doubles each time. The settings live in `src/config.js` as `retryCfg = { n: 3, ms: 200 }`, and the loop is a new `withRetry` helper.
> 
> CI is green, but the call limit is only tested with a call that succeeds on its third try, and that test passes with both bugs below.
> 
> **Findings**
> - **P1, second opinion:** `src/client.js:10` passes the settings in the wrong order. `retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3). A GET that keeps failing is called 200 times, with a wait that starts at 3 ms and doubles each time, so in practice it never gives up.
> - **P1, Spec:** `src/retry.js:9` checks `attempt + 1 === retries`, so `retries` counts every call, not just the retries. I ran it: `retries: 3` stops after 3 calls where the issue allows 4, and `retries: 0` never stops (238 calls in 300 ms). The issue says "`retries: 0` makes exactly one call."
> - **P2, Spec (design):** `test/retry.test.js:5` is the only test. It needs a case for `retries: 0` and one for an always-failing call.
> 
> **Question for the author:** Every response that isn't OK gets retried, 4xx included (`src/client.js:9`). Is retrying a 404 intended?
> 
> **Verifier:** Not run. The PR doesn't touch authority, data, money or a production switch.
> 
> **Suggested verdict:** Request changes. Both P1s mean a GET that keeps failing never gives up.
> 
> There's 1 style and smell note; say `what else` to see it. #5's prep is running in the background.
> 
> Say `next`, `approve`, `request changes and post`, or add a comment.
