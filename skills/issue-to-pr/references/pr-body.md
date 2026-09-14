# PR body template

Fill every section from the run record and the stage reports already in hand. Handles (commit SHAs, test names, commands) say *where*; the Evidence section says *that it is true*, and its primary proof is the feature seen running: a screenshot, a recording, a transcript, a before/after pair, captured at HEAD and published per the repo's `EVIDENCE.md`. Tests are supporting material below the capture, never the evidence on their own. Write `none` rather than dropping a section, so the reader knows it was considered. Keep the prose under 400 words; evidence excerpts sit in collapsed blocks and do not count.

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

**Seen working** (captured at `<HEAD short sha>`, surface: <web | mobile | desktop | TUI | CLI | API>).

<![after](<published link>) for a state, or a link to the recording for a flow, or a fenced transcript for a CLI or API. For changed behaviour, before at `<base short sha>` and after at HEAD side by side. One or two sentences saying what the reviewer is looking at and which part proves the criterion. If `EVIDENCE.md` exempts this surface: `exempt: <reason>` and the test below is the proof.>

**Supporting test, red → green.** The test failed before the change and passes after it.

```text
# before `<impl short sha>` (test committed at `<test short sha>`)
<the failing assertion line(s) from the test runner, at most 5 lines>

# at `<HEAD short sha>`
<the passing summary line for that test, 1–3 lines>
```

**Reproduce.** `<exact command a reviewer runs from the repo root to see the passing test>`

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
- Every Evidence block leads with a capture of the feature running, published and linked with the HEAD it came from, unless `EVIDENCE.md` exempts that surface. A block with only test output is incomplete.
- The verification table lists every command `/verify` discovered, including the ones that could not run.
- The HEAD in "Verification" must equal the PR head at publish time. After a watch-stage repair, regenerate the body for the new HEAD and update the PR with `gh pr edit --body-file`.
- Evidence excerpts are real, trimmed output from this run's HEAD, never paraphrased or typed by hand. If an excerpt cannot be produced (the test could not run), the block says so and the criterion's status is `blocked`.
- Trim to the lines that carry the proof: the failing assertion, the passing summary, the changed output. No full logs, no diffs (the PR has them). Captures are stills for states, recordings under 30 seconds for flows, transcripts for CLIs and APIs; pick the lightest a reviewer would accept as seeing it work.
