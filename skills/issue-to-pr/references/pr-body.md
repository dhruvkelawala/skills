# PR body template

Fill every section from the run record and the stage reports already in hand. Handles (commit SHAs, test names, commands) say *where*; the Evidence section says *that it is true*, with bounded excerpts of real output a reviewer can re-run. Write `none` rather than dropping a section, so the reader knows it was considered. Keep the prose under 400 words; evidence excerpts sit in collapsed blocks and do not count.

```md
## Summary

<One paragraph: what this PR does for the user or developer, in plain words. Closes #<issue>.>

## Why

<The problem or request, one to three sentences. Link the issue. Name the root cause when this is a fix.>

## Changes

- <one line per conceptual change, not per file; name the entry point a reviewer should read first>

## Acceptance criteria

| Criterion | Commit | Test | Status |
| --- | --- | --- | --- |
| <criterion text from the contract> | `<short sha>` | `<test name or file>` | met \| blocked: <reason> |

## Evidence

One block per acceptance criterion. Each block proves the criterion with output, not description.

<details>
<summary>AC1 — <criterion text></summary>

**Red → green.** The test failed before the change and passes after it.

```text
# before `<impl short sha>` (test committed at `<test short sha>`)
<the failing assertion line(s) from the test runner, at most 5 lines>

# at `<HEAD short sha>`
<the passing summary line for that test, 1–3 lines>
```

**Reproduce.** `<exact command a reviewer runs from the repo root to see the passing test>`

**Behaviour.** <For a user-visible change: one before/after pair of real output, a captured request/response, a CLI invocation with its output, or a screenshot when the issue is about UI. Trimmed to the lines that show the difference. Omit for pure internals and say `covered by the test above`.>

</details>

## Verification

Run at `<HEAD short sha>` against base `<base short sha>`.

| Check | Command | Result |
| --- | --- | --- |
| <tests / typecheck / lint / build> | `<exact command>` | passed \| failed \| could-not-run: <what was missing> |

<details>
<summary>Full-suite summary lines</summary>

```text
<the runner's final summary line per command, e.g. "Tests: 212 passed, 0 failed", and the typecheck/lint tail, at most 3 lines each>
```

</details>

<For UI work: one line naming what was checked in the running app, or `not applicable`.>

## Review trail

- Code review (`/code-review <base short sha>`): <n> passes; <count> findings fixed, <count> rejected (<one-line reason each, or none>)
- Autoreview: <engine/model>, <clean | findings fixed: n>
- Review-ready gate: <clean | exceptions: one line each>

## Risks and follow-ups

- <what a reviewer should look at hardest, or none>
- <deferred work with a handle, or none>

## Stack

<Stacked only. `Layer on #<predecessor> (<predecessor head branch>); merge bottom-up.` Omit the section for standalone.>
```

Rules:

- Every criterion row carries a commit and a test, or `blocked` with the reason. A row with neither means stage 2 is not complete.
- The verification table lists every command `/verify` discovered, including the ones that could not run.
- The HEAD in "Verification" must equal the PR head at publish time. After a watch-stage repair, regenerate the body for the new HEAD and update the PR with `gh pr edit --body-file`.
- Evidence excerpts are real, trimmed output from this run's HEAD, never paraphrased or typed by hand. If an excerpt cannot be produced (the test could not run), the block says so and the criterion's status is `blocked`.
- Trim to the lines that carry the proof: the failing assertion, the passing summary, the changed output. No full logs, no diffs (the PR has them), no screenshots unless the change is visual.
