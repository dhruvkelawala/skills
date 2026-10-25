# PR body

The body has two tiers. The top fills the `pr` skill's template and stays under 250 words, so a reviewer reads it in two minutes. Everything else goes in one collapsed `<details>` block below it. Fill both from the run record. Paste real output and published links, and keep the excerpts trimmed.

````md
<The problem as the user saw it, in one or two sentences, then what changed for them. Closes #<issue>.>

<A diagram from the `pr` skill's menu, only when no capture shows the change, such as a logic, tooling or data-flow change.>

## Evidence

<For each change the user sees, one line on what to look at, then:>

| Before | After |
| --- | --- |
| ![<what the reader sees on the base>](<published capture>) | ![<what the reader sees at the head>](<published capture>) |

<For a CLI or API change, a short fenced **Before:** and **After:** transcript in place of the table. For a new behaviour, the After alone. For an exempt criterion, one line: "<criterion>: exempt, per `EVIDENCE.md`: "<quoted line>"." Its red and green lines are in Criteria.>

**Proof:** <Where the change ran, what was checked by hand, and that `/verify` passed, by its command.>

Reviewed: <one line, such as "two `/code-review` passes and autoreview, every finding fixed or answered below".>

**Not checked:**

- <One short item each: an exempt check, a check `/verify` could not run, a judgement call such as visual quality. Leave the list out when nothing is left.>

**Door:** <one-way | two-way>. <Why, in one sentence. For a layer, add: Merge after #<predecessor>.>

**Blast radius:** <one word>. <What breaks, and for whom, if this is wrong.>

<details>
<summary>Criteria, verification and review trail</summary>

### Criteria

| Criterion | Commit | Test | Evidence |
| --- | --- | --- | --- |
| <criterion> | `<short sha>` | `<test name>` | [capture](<link>), or exempt |

```text
<per criterion: the red line before the change and the green line at head>
```

### Verification

Captured at `<capture short sha>`. Run at `<head short sha>` against base `<base short sha>`.

| Check | Command | Result |
| --- | --- | --- |
| <tests, typecheck, lint, build> | `<command>` | passed, failed, or could not run: <what was missing> |

### Review trail

- `/code-review` pass 1 at `<short sha>`: <n> fixed, <n> rejected with reasons
- Autoreview, <engine and model>, tree `<short hash>`: <clean, n fixed, or skipped: reason>
- `/code-review` pass 2 over the repairs: <n fixed, or skipped: light lane or tree unchanged>
- Review-ready: <clean, exceptions, or skipped: light lane>
- Not re-reviewed: <repair commits made after the last pass, or none>
- Follow-ups, P2 and lower: <one line each, or none>

</details>
````

## One PR for a spec

A `--one-pr` build's body covers every ticket in the spec:

- The opening paragraph closes each ticket with a keyword of its own, as in `Closes #12. Closes #13.`, because GitHub closes only the issue right after each keyword, and `Closes #12, #13` leaves #13 open.
- Evidence groups the criteria under one bold `**#<n> <title>**` line per ticket, in the `Tickets:` order.
- The criteria table keeps each criterion's `#<n>:` prefix.

`spec.mjs body <record> < <body file>` checks the first two before stage 5 publishes the PR.

## Picking the door

Write `one-way` for a migration, data deletion, a production switch such as a flag flip or a config change that moves live traffic, a public API or schema change that consumers will adopt, and anything else that is hard to roll back once merged and deployed. Write `two-way` when a revert commit fully undoes the change.

Every PR carries the `**Door:**` line spelled exactly as above, because `/ship` reads it to decide who must approve. `/ship` treats a PR with no door line as needing human approval.

## The check

Before `gh pr create` and before every `gh pr edit --body-file`, check the body file:

```bash
node <issue-to-pr>/scripts/pr-body.mjs < <body file>
```

`<issue-to-pr>` is the folder that holds this file's `references` folder. The check refuses more than 400 words above the first `<details>`, not counting image markup and URLs, a backticked commit SHA above it, and an image anywhere whose alt text is its file name or `<file> @ <sha>`. Each problem names its line. Rewrite the body and check it again until it prints `the body passes`. [Lore #78, rewritten](../scripts/fixtures/lore-78.md) is a full body that passes.

## Rules

- Each criterion has a link to a capture of the feature running, in Evidence or in the Criteria table, or a quoted exemption. Test output alone is the proof only for an exempt criterion.
- The top tier names no commit. SHAs, the base and the head, earlier builds and review rounds, red and green lines, log links and verifier output go in `<details>`.
- Alt text says what the reader sees in the capture, such as "The polaroid fading in with the shared photo already in it".
- The verification table lists every command `/verify` found, including the ones that could not run.
- The head in Verification equals the PR head. After every push, refresh the body for the new head, check it, and update it with `gh pr edit --body-file` (REST: `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -F body=@<file>`).
- Excerpts are real output from this run, trimmed to the failing assertion, the passing summary or the changed output. Leave out full logs and diffs, since the PR already shows the diff.
- For each capture, pick the lightest proof a reviewer would accept as seeing the feature work: a still for a state, a recording under 30 seconds for a flow, or a transcript for a CLI or API.
