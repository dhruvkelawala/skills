# PR body

The body has two tiers. The top fills the `pr` skill's template and stays under about 400 words, so a reviewer can read it in two minutes. Everything else goes in one collapsed `<details>` block below it. Fill both from the run record. Paste real output and published links, and keep the excerpts trimmed.

````md
## Summary

<One or two plain sentences on what this changes for the user or developer. Closes #<issue>.>

<One diagram from the `pr` skill's menu: pseudocode, a call tree, a component tree, a file tree, Mermaid, or a diff sketch. Pick the smallest view that shows the change.>

## Evidence

- **<criterion>**
  **Before:** <capture at `<base short sha>`, or "none, the behaviour is new">
  **After:** <published capture at `<head short sha>`: an image, a recording link, or a short fenced transcript>
- **<exempt criterion>** Exempt, per `EVIDENCE.md`: "<quoted line>". Red: `<failing assertion>`. Green: `<passing summary>`.

## Merge danger

**Door:** <one-way | two-way>

<One sentence on why. For a layer, add: Merge after #<predecessor>.>

**Blast radius:** <one word>

<One or two sentences on what breaks, and for whom, if this is wrong.>

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

Run at `<head short sha>` against base `<base short sha>`.

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

## Picking the door

Write `one-way` for a migration, data deletion, a production switch such as a flag flip or a config change that moves live traffic, a public API or schema change that consumers will adopt, and anything else that is hard to roll back once merged and deployed. Write `two-way` when a revert commit fully undoes the change.

Every PR carries the `**Door:**` line spelled exactly as above, because `/ship` reads it to decide who must approve. `/ship` treats a PR with no door line as needing human approval.

## Rules

- Each criterion has an After link to a capture of the feature running, or a quoted exemption. Test output alone is the proof only for an exempt criterion.
- The verification table lists every command `/verify` found, including the ones that could not run.
- The head in Verification equals the PR head. After every push, refresh the body for the new head with `gh pr edit --body-file`.
- Excerpts are real output from this run, trimmed to the failing assertion, the passing summary or the changed output. Leave out full logs and diffs, since the PR already shows the diff.
- For each capture, pick the lightest proof a reviewer would accept as seeing the feature work: a still for a state, a recording under 30 seconds for a flow, or a transcript for a CLI or API.
