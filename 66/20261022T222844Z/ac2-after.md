# AC2 after: /issue-to-pr <plan file> (head 540dd05)

Skill text: issue-to-pr and ticket at 540dd05, run in headless Claude Code in a scratch repo (acme/demo) with a fake gh that records every call.

## The command

```text
/issue-to-pr plans/001-json-export.md
```

## Skills the run loaded

- ticket: plans/001-json-export.md

## gh calls, in order

```text
gh repo view --json name,defaultBranchRef --jq .name+" "+.defaultBranchRef.name
gh repo view --json nameWithOwner --jq .nameWithOwner
gh issue list --state all --limit 5 --json title,body
gh label list --json name --jq .[].name
gh issue create --title Export tables as JSON with --format json --body-file <tmp> --label ready-for-agent
gh issue view 101 --json title,labels,comments --jq {title, labels:[.labels[].name], comments:(.comments|length)}
```

## Issues filed

### #101 Export tables as JSON with --format json

Labels: ready-for-agent

```md
## What's wrong

`demo export` only writes CSV, so scripts that read the export have to parse CSV by hand.

## What to build

Add `--format <csv|json>` to `demo export`, with csv as the default. JSON output is an array of row objects keyed by column name. Any other format name exits with code 2 and prints "unknown format: <name>".

## Acceptance criteria

- `demo export --format json` prints an array of row objects with the CSV's columns.
- `demo export` with no option still prints CSV.
- `demo export --format xml` exits with code 2 and prints "unknown format: xml".

## In scope

`src/cli.ts`, `src/export.ts` and `src/export.test.ts`. `demo import` is out of scope.

From `plans/001-json-export.md`.
```

## Where the run ended

- turn ended (exit 0)
- read the filed issue with gh: yes
- build branch for a filed issue: none

## The agent's last message

> I filed the plan as an issue, then stopped at stage 1.3, where the build has to move into its own T3 thread and worktree. T3 tools aren't available in this sandbox.
> 
> **Done so far:**
> - **Base:** `origin/main` is pinned at `ab9ee46d36ad7e49e32d32e15b5e7d4c8916c9dc` on `acme/demo`, standalone mode.
> - **Issue:** Filed #101 with the `ready-for-agent` label: https://github.com/acme/demo/issues/101. It covers the plan's three done criteria (JSON output, CSV still the default, `xml` exits 2 with "unknown format: xml"). Scope is `src/cli.ts`, `src/export.ts` and `src/export.test.ts`, with `demo import` out of scope.
> 
> **Where it stopped:** This thread is on the main checkout (`main`, no other worktrees), so the next step is a worktree handoff. This is the call I would make, as the last call of the turn:
> 
> ```
> t3_worktree_handoff({
>   branch: "feat/101-json-export",
>   baseRef: "main",
>   startFromOrigin: true,
>   continuationPrompt: "/issue-to-pr 101"
> })
> ```
> 
> Nothing else has run. There's no branch and no run record, and nothing was written in the main checkout. Stages 2 to 7 haven't started, and the repair budget is still 0/10.
> 
> `plans/` is still untracked on `main`. Nothing reads it from here on, because the issue now holds everything the build needs.
> 
> To continue, run `/issue-to-pr 101` from a session that has T3, or `/issue-to-pr 101 resume`.
