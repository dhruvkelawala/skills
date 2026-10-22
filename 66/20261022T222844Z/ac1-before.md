# AC1 before: /issue-to-pr with no argument, after a conversation (base cb14ee7)

Skill text: issue-to-pr and ticket at cb14ee7, run in headless Claude Code in a scratch repo (acme/demo) with a fake gh that records every call.

## Turn 1 (the conversation)

User:

> I'm thinking about `demo export`. It only writes CSV, and I want a `--format json` option too.
> JSON output should be an array of row objects with the same columns as the CSV, and csv stays the default.
> `--format xml`, or any other unknown name, should exit with code 2 and print "unknown format: xml".
> The change should stay in src/cli.ts, src/export.ts and src/export.test.ts.
> Does that fit the code? Read it and tell me in a few lines. Don't change anything.

Agent:

> Yes, it fits. The change touches three small files and nothing else.
> 
> - **`src/export.ts`**: `exportTable(table)` only builds CSV. You can add a `format` parameter that defaults to `"csv"`. The JSON path maps each row to an object keyed by `table.columns`, so the column set matches the CSV header. Values stay strings because `rows` is `string[][]`.
> - **`src/cli.ts`**: there's no flag parsing. It reads `[command, file]` straight from `argv`, so you'd add a small `--format <name>` parse there. One thing to decide: as written, `demo export --format json t.json` would treat `--format` as the file name. Either accept the flag anywhere or require it after the file.
> - **Exit code 2**: the unknown-command path already does `console.error(...)` then `process.exit(2)`, so "unknown format: xml" can copy that pattern. Check the format in `cli.ts` before reading the file.
> - **`src/export.test.ts`**: has one vitest CSV test. JSON and default-format tests go there. The exit-code check lives in `cli.ts`, though, so either test it by spawning the CLI or have `export.ts` throw on an unknown format and test that.
> - **Can't run tests**: the repo has no `package.json`, so vitest isn't installed and the tests won't run as it stands. If you want them run, a `package.json` would be needed, outside the three files you listed.

## The command

```text
/issue-to-pr
```

## Skills the run loaded

- none

## gh calls, in order

```text
gh issue list --limit 10
```

## Issues filed

None.

## Where the run ended

- turn ended (exit 0)
- read the filed issue with gh: no
- build branch for a filed issue: none

## The agent's last message

> I didn't start a run because `/issue-to-pr` needs a work item and none was given. The skill takes an issue number, URL or Linear ticket, and I won't guess one.
> 
> There's also no issue yet for the `--format json` change we just talked about. The repo has only two issues:
> - **#41 "Show the import progress as a percentage"** (open, `ready-for-agent`). Its scope is `src/import.ts`, which doesn't exist in this checkout.
> - **#40 "Export drops rows with an empty first column"** (closed).
> 
> Which do you want?
> 1. **File the `--format json` change as an issue, then build it.** I'd write it from what you said: csv stays the default, JSON is an array of row objects, unknown names exit 2 with "unknown format: <name>", and the change stays in `cli.ts`, `export.ts` and `export.test.ts`. Then I'd run `/issue-to-pr <n>` on it. Filing it publishes to the remote, so I'm asking first. One thing to know: there's no `package.json`, so `/verify` can't run vitest unless the scope also allows adding one.
> 2. **Run `/issue-to-pr 41`.** It will likely stop as blocked, because the file it targets is missing.
> 3. **Give me a different issue number.**
