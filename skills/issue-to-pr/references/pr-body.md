# PR body template

Fill every section from the run record and the stage reports already in hand. Evidence is handles and results (commit SHAs, test names, commands, exit status), never logs or transcripts. Write `none` rather than dropping a section, so the reader knows it was considered. Keep the whole body under 400 words plus the tables.

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

## Verification

Run at `<HEAD short sha>` against base `<base short sha>`.

| Check | Command | Result |
| --- | --- | --- |
| <tests / typecheck / lint / build> | `<exact command>` | passed \| failed \| could-not-run: <what was missing> |

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
- No raw output, no diffs, no screenshots unless the issue asked for one.
