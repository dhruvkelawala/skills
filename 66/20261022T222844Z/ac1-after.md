# AC1 after: /issue-to-pr with no argument, after a conversation (head 540dd05)

Skill text: issue-to-pr and ticket at 540dd05, run in headless Claude Code in a scratch repo (acme/demo) with a fake gh that records every call.

## Turn 1 (the conversation)

User:

> I'm thinking about `demo export`. It only writes CSV, and I want a `--format json` option too.
> JSON output should be an array of row objects with the same columns as the CSV, and csv stays the default.
> `--format xml`, or any other unknown name, should exit with code 2 and print "unknown format: xml".
> The change should stay in src/cli.ts, src/export.ts and src/export.test.ts.
> Does that fit the code? Read it and tell me in a few lines. Don't change anything.

Agent:

> Yes, it fits. The three files are the whole program apart from a one-line README, so nothing outside them needs to change.
> 
> - **`src/export.ts`**: `exportTable(table)` only builds CSV right now. Give it a `format` argument that defaults to `"csv"` and add a JSON branch that maps each row to `{ [column]: value }`. Every value in `Table.rows` is a string, so the JSON will be strings too (`{"id":"1","name":"Ada"}`, not `1`). That seems right for "same columns as the CSV," but you should know it happens.
> - **`src/cli.ts`**: it reads `argv` by position (`[command, file]`), so it can't handle flags yet. You'll need a small parse step for `--format <name>` that works whether the flag comes before or after the file. Node's built-in `util.parseArgs` does this, so there's no new dependency.
> - **Unknown format**: the CLI already handles an unknown command with `console.error(...)` and `process.exit(2)`. "unknown format: xml" can work the same way, which keeps it consistent and sends the message to stderr. I'd check the format in `cli.ts`, or have `exportTable` throw and let the CLI catch it and exit 2. Either way, `export.ts` stays free of `process` calls.
> - **`src/export.test.ts`**: there's one vitest test for CSV. Add a JSON case and a default-is-CSV case there. The exit-2 behavior lives in `cli.ts`, which has no tests, so testing it means either running the CLI in a subprocess test or accepting that it's checked by hand.

## The command

```text
/issue-to-pr
```

## Skills the run loaded

- ticket: --format json for `demo export` (from this conversation), invoked by /issue-to-pr stage 1

## gh calls, in order

```text
gh repo view --json name --jq .name
gh repo view --json nameWithOwner
gh issue list --state all --limit 5 --json title,body
gh label list --json name --jq .[].name
gh issue create --title Add --format json to demo export --body-file /tmp/i2p-ticket/body.md --label ready-for-agent
```

## Issues filed

### #101 Add --format json to demo export

Labels: ready-for-agent

```md
## What to build

`demo export` only writes CSV. Add a `--format` option so it can also write JSON. CSV stays the default.

## Acceptance criteria

- `demo export <table.json> --format json` prints a JSON array with one object per row, keyed by the same columns as the CSV header.
- `demo export <table.json>` with no `--format`, or with `--format csv`, prints the same CSV as today.
- `demo export <table.json> --format xml`, or any other unknown name, prints `unknown format: xml` (with the given name) and exits with code 2.

## In scope

`src/cli.ts`, `src/export.ts` and `src/export.test.ts`.
```

## Where the run ended

- build branch feat/101-export-json-format
- read the filed issue with gh: no
- build branch for a filed issue: feat/101-export-json-format

## The agent's last message

> Filed #101, ready-for-agent: https://github.com/acme/demo/issues/101
> 
> Continuing `/issue-to-pr` with #101. Step 1.3 moves the build into its own T3 worktree, so I'm looking for the T3 tools.
