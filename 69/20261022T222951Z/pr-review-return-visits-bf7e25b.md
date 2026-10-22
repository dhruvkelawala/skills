# pr-review eval, return visits, at bf7e25b

## push return-visit (head bf7e25b)

Events in transcript order:

call  Skill code-review
call  Bash D=$HOME/.agent/pr-review/demo/7; cd $D git rev-parse refs/pr-review/7-base; git diff refs/pr-review/7-base...HEAD; echo ===SINCE-SEEN; git diff refs/pr-review/7-seen..HEA…
call  Bash D=$HOME/.agent/pr-review/demo/7; cd $D echo "--- since seen"; git diff refs/pr-review/7-seen..HEAD ls -a; ls .agents/skills .claude/skills 2>/dev/null for p in .agents/sk…
call  Bash cd $HOME/.agent/pr-review/demo/7 && "$HOME/.agents/skills/autoreview/scripts/autoreview" --mode branch --base fb0dea8d7802d761342407cbc73796c818fa7397 --engine codex --mo…
call  t3:orchestrator_capabilities
  ←   second opinion: autoreview findings: 0, overall: patch is correct (0.90)
call  t3:delegate_task model=claude-fable-5-1 mode=async title="code-review Standards PR 7"
call  t3:delegate_task model=claude-fable-5-1 mode=async title="code-review Spec PR 7"
call  t3:task_status
  ←   report: ## Standards
call  t3:task_status
  ←   report: ## Spec
text  INTRO: **PR 7, return visit (1 of 1):** https://github.com/acme/demo/pull/7 **Since your last look:** last time you …

The review:

**PR 7, return visit (1 of 1):** https://github.com/acme/demo/pull/7

**Since your last look:** last time you decided to approve at `48c3a80` and nothing was posted. GitHub has no threads on this PR. Of the three findings open then, 2 are fixed and 1 is partly fixed (details below).

This PR makes `fetchJson` retry a failed GET with exponential backoff, as issue #6 asks. The new commit `326a6be` fixes both P1s from last time. I ran `fetchJson` against a server that always returns 503: it made 4 calls, at 0, 200, 600 and 1400 ms, then threw `GET http://x/y: 503`. That matches the issue: 3 retries, 200 ms before the first, and the delay doubles each time. CI is green and `node --test` passes 2 of 2. The patch ID changed and the base is the same, so this is a real change and not a rebase. Both reviewers reran on the whole PR.

**Tour of what changed since `seen`**

1. [client.js:10](<review checkout>/src/client.js:10): the settings are no longer swapped. `retries` now gets `retryCfg.n` and `delayMs` gets `retryCfg.ms`. **Earlier P1 (second opinion): fixed.**
2. [retry.js:9](<review checkout>/src/retry.js:9): the stop check is now `attempt === retries`, so the helper makes `retries + 1` calls and `retries: 0` makes exactly one. **Earlier P1 (/code-review Spec): fixed.**
3. [retry.test.js:16-23](<review checkout>/test/retry.test.js:16): adds a test that `retries: 0` makes one call. **Earlier P2 test gap: partly fixed.** No test checks the 4-call limit or how `fetchJson` passes its settings. If someone swaps the settings back, the suite still passes.

There's no design change in the delta, and the README is unchanged since your last look.

**Wrap-up**

- **Findings:** neither reviewer found a new P0 or P1. The second opinion found nothing ("patch is correct", 0.90) and the /code-review Spec reviewer had no findings. The only open item from the reviewers is the P2 test gap in stop 3.
- **Question for the author** (still open, never asked): [client.js:9](<review checkout>/src/client.js:9) retries every error, including a 404 and a JSON parse failure. Is that intended?
- **Verifier:** not run. The PR doesn't touch authority, data, money or a production switch.
- **Suggested verdict:** approve. Both P1s are fixed and I confirmed the fix by running it. You could add "Non-blocking:" comments for the test gap and the 4xx question.
- 1 style and smell note (P2, /code-review Standards); say `what else` to see it.

Nothing has been posted. Say `next`/`approve`, or `approve and post` to draft and send the review.

## rebase return-visit (head bf7e25b)

Events in transcript order:

text  INTRO: https://github.com/acme/demo/pull/7. This is PR 1 of 1, and you've seen an earlier version. **Your earlier co…

The review:

https://github.com/acme/demo/pull/7. This is PR 1 of 1, and you've seen an earlier version.

**Your earlier comments:** none. Last time you said `approve` at `714c526` without comments, and nothing was posted. Nobody has commented on GitHub since.

**Since you last looked: only a rebase.** The branch moved onto `734a9ab`, where main added `docs/service.md` and nothing else. The patch ID is the same as before (`a95b2f7…`), and `git range-diff` marks both commits `=`. I didn't rerun the reviewers, and the earlier findings are unchanged. CI is green.

**Findings, all still open at the new head:**

1. [client.js:10](<review checkout>/src/client.js:10): **P1, second opinion.** `retries: retryCfg.ms, delayMs: retryCfg.n` swaps the two settings. A failing GET is tried 200 times, starting 3 ms apart, instead of retrying 3 times starting 200 ms apart.
2. [retry.js:9](<review checkout>/src/retry.js:9): **P1, /code-review Spec.** `attempt + 1 === retries` counts total calls, not retries, so `retries: 3` means 3 calls instead of 4. With `retries: 0`, the check never matches and it retries forever.
3. [retry.test.js:5](<review checkout>/test/retry.test.js:5): **P2 design, /code-review Spec.** The tests only cover the helper's happy path. Nothing tests the call limit, `retries: 0`, or how `fetchJson` passes in the settings, which is why green CI didn't catch either P1.

**Question for the author:** should it retry on every error, including 4xx responses and JSON parse failures? The issue only says "a failed GET".

**Suggested verdict: request changes.** Both P1s are in the code that runs on every failing GET. The settings swap turns one failed request into 200 rapid calls to the service. Your earlier `approve` was given with the same two P1s open. The rebase changed nothing, so you can keep that decision if you meant it.

1 style and smell note; say `what else` to see it.

Reply `next` or `approve` to record your decision, or "request changes and post" for me to draft a review to post.
