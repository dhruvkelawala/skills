# pr-review eval, first visits, at f162b42

## push first-visit (head f162b42)

Events in transcript order:



The review:

```text
#7 Retry failed GET requests (teammate)   +38 -3 in 5 files   about 5 min
CI green. No approvals, review required. Door: two-way, as the PR says. Ship verdict: none.
Claims: "GET requests now retry with exponential backoff". Proof: tests only, and only for withRetry. fetchJson has no test.
Design lives in: retry.js, client.js. config.js, the README and the test carry it out.
```

**1 of 1: #7**

**What it does.** `fetchJson` wraps every call in a new `withRetry` helper. When a call fails it waits and calls again, doubling the wait each time. Issue #6 asks for a 200 ms first wait and `retries: 3`, meaning up to 4 calls.

**Design changes**

**1. Every `fetchJson` call retries, whatever the error.**
```diff
 fetchJson(url)
-  fetch → throw on !ok
+  withRetry(retries, delayMs)
+    fetch → throw on !ok → parse JSON
+    any throw → sleep delayMs·2^attempt → call again
```
Every caller now gets retries, and nothing decides which errors are worth retrying. A 404, a 400 and a JSON parse error are all retried just like a 503 or a network failure. So a bad request now costs the whole backoff before it fails.
**Judge:** should 4xx responses and parse errors fail at once, with retries kept for 5xx and network errors? [client.js:6](<review checkout>/src/client.js:6)

**2. The retry settings are a module constant, not an option.**
`retryCfg = { n: 3, ms: 200 }` is imported straight into client.js. Callers and tests can't change it per call, though `fetchImpl` already shows the file's pattern for injecting things. It's easy to change later, so it shouldn't block.
**Judge:** is one global setting enough, or should `fetchJson` take `retries` and `delayMs` alongside `fetchImpl`? [config.js:1](<review checkout>/src/config.js:1)

**Findings**

- **P0: the settings are passed in swapped.** The call passes `retries: retryCfg.ms, delayMs: retryCfg.n`, so the result is 200 attempts starting 3 ms apart. The wait doubles every attempt, so by about attempt 25 it is days long. A failing GET effectively never returns. [client.js:10](<review checkout>/src/client.js:10)
- **P1: `retries` counts total calls, not retries.** The code stops at `attempt + 1 === retries`. I ran it: `retries: 3` makes 3 calls, but #6 says 4. With `retries: 0`, the check `attempt + 1 === 0` is never true, so it loops forever. My run made 258 calls in 300 ms. Both break #6's acceptance criteria. [retry.js:9](<review checkout>/src/retry.js:9)
- **P1: the test hides both bugs.** It checks `withRetry` alone with `retries: 3` and success on call 3, which is the one case where "3 calls" and "3 retries" look the same. Nothing tests `fetchJson` or `retries: 0`, so CI is green despite the P0. [retry.test.js:5](<review checkout>/test/retry.test.js:5)

1 smaller finding: the `n`/`ms` names invite this kind of swap. Say `what else` to see it.

**Suggested verdict: request changes.** Every failing GET hangs (P0), and the retry count doesn't match #6 (P1).

Two things to know:
- The PR is pinned at `518a4d5`, with a review checkout at `~/.agent/pr-review/demo/7`.
- In that checkout, `node --test` printed a recursion warning and no results. I didn't look into it.

It's teammate's PR, so I can draft a review with inline comments on these three findings. Nothing gets posted until you say `post`. Say `next`, `deeper`, `what else`, `try`, or add a comment.

## rebase first-visit (head f162b42)

Events in transcript order:



The review:

```text
#7 Retry failed GET requests (teammate)   +38 -3 in 5 files   about 4 min
CI green (test). No approvals. Door: two-way (the PR body says so). Ship verdict: none.
Claims: "GET requests now retry with exponential backoff". Proof: tests only, and the only test calls withRetry directly, never fetchJson.
Design lives in: client.js, retry.js, config.js. README and the test carry it out.
```

**PR 1 of 1: #7 Retry failed GET requests**

**What it does.** `fetchJson` used to make a single attempt and throw on the first failure. Now it wraps the request in a new `withRetry` helper, with the settings read from `retryCfg = { n: 3, ms: 200 }`. The intent is that `fetchJson("/users")` returning a 503 gets up to 3 attempts, waiting 200 ms and then 400 ms between them, before it throws.

**Design changes**

**1. Every failed GET is retried, whatever the error.**
```diff
 fetchJson(url)
-  fetch, throw on !res.ok
+  withRetry(attempt, { retries, delayMs })
+    attempt: fetch, throw on !res.ok, res.json()
+    any throw → sleep delayMs·2^k → try again
```
Nothing separates a transient error from a permanent one. A 404, a 401 or a JSON parse error gets the same backoff as a 503 or a network reset. Every caller gets this behaviour, and none of them can opt out.
**Judge:** should a 4xx fail fast, so only network errors and 5xx/429 retry? [retry.js:9](/var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-rebase-hS78rC/home/.agent/pr-review/work/7/src/retry.js:9)

**2. The retry policy is a module constant, not a per-call option.**
`retryCfg` is a hard-coded export in [config.js:1](/var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-rebase-hS78rC/home/.agent/pr-review/work/7/src/config.js:1). No env var or argument can change it, and tests of `fetchJson` can't shorten it.
**Judge:** is one global policy enough, or should `fetchJson` take `retry` the same way it already takes `fetchImpl`?

**Findings**

- **P0: the two settings are swapped, so a failing GET hangs for weeks.** [client.js:10](/var/folders/gb/5zblj76s5qzbw0_f093ldm4r0000gn/T/pr-review-eval-rebase-hS78rC/home/.agent/pr-review/work/7/src/client.js:10) passes `retries: retryCfg.ms, delayMs: retryCfg.n`. That gives 200 attempts starting at a 3 ms delay and doubling each time. Before the 30th attempt the wait has reached about 18 days. I ran it in the review checkout with a `fetchImpl` that always returns 404: 11 calls in the first 3 s (5, 11, 25, 50, 99, 196, 389, 774, 1545, 3083 ms), and the call was still pending when I stopped it. The unit test misses this because it calls `withRetry` with literal values and never goes through `fetchJson`. The fix is to swap the two settings and add a test that goes through `fetchJson` with a fake `fetchImpl`.
- **P1: 4xx responses are retried** (design change 1). Combined with the swap above, any 404 is enough to trigger the hang.

2 smaller findings; say `what else` to see them.

**Suggested verdict: request changes.** The P0 means the first persistent error stalls the caller for weeks. The fix is a one-line swap plus a test through `fetchJson`.

Your word: `next` / `approve`, `deeper`, `what else`, `how`, `try`, a comment for the ledger, or `stop`.
