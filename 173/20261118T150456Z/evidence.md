# Hosted review repairs for #173

Captured at `4532efcd28c04ad7e2cbc65cd168da183cf2b4bc`, tree `7b48bd1f4d05b0894ad4ff792b397797d29d2791`, after review of `e1eacc9b83595c2b6af3b89ab23a1546b63b8b27`.

## Installer from a checkout subdirectory

The real `sync-skills.mjs` CLI ran with an isolated HOME and local pinned upstream. Only the script changed between these invocations. The caller stayed in the fixture checkout's `skills/` directory.

```text
$ cd <fixture-checkout>/skills
$ node ../scripts/sync-skills.mjs
Before, e1eacc9:
  exit 1
  sync-skills: grilling: patches may change only pinned regular files
  No agent folder changed.
After, 4532efc:
  exit 0
  made 8 changes
  Installed executable: #!/bin/sh\necho measured\n
Repeat:
  exit 0
  nothing to change
```

`installer-result.json` retains the selected CLI output. The capture changed no global installation.

## Coverage through the watcher and live Langfuse

Synthetic Claude transcript counters passed through the actual `watch(config, home)` interface and delivery modules to the live Langfuse API. A terminal run declared one helper. Its stage, head and record contents stayed fixed while its transcript gained current counters.

```text
Old counters before enrollment:
  watcher: markers 1, requests 0, pending 0
  stored terminal coverage: partial
Current counters arrive:
  watcher: markers 1, requests 1, pending 0
  stored terminal coverage: complete
  source tokens 12, stored tokens 12
  same terminal observation ID, one distinct terminal observation
Fresh run with current counters already present:
  first watcher pass: markers 1, requests 1
  stored terminal coverage: complete
Repeat:
  markers 0, transcripts 0, requests 0
```

`coverage-result.json` retains the sanitized readback. API list rows briefly contained both versions of the same observation, so the capture deduplicated by observation ID as `instrumentation/queries.md` requires. No prompt canary, selected input or output appeared in stored observations. This proves the adapter and backend with synthetic transcripts. It does not prove an automatic hook from a fresh T3 session.

## Regression checks

The existing owner tests failed on the reviewed code, then passed after repair:

```text
Patch CLI from subdirectory: exit 1 instead of 0.
Counters before enrollment: measured true instead of false.
First watcher marker after counters: partial instead of complete.
Sidecar receipt with unchanged stage/head: partial instead of complete.
Green: 4 targeted cases pass, 0 fail.
Focused suites: 28 pass, 0 fail.
Full node --test at 4532efc: 371 pass, 0 fail, four suites.
Artifact audit, worktree audit, patched autoreview usage contract: PASS.
git diff --check: clean.
```

Reproduce the regression checks from the repository root:

```sh
node --test --test-name-pattern='pinned outside-skill patch|bounded hook|helper coverage becomes|autoreview sidecars' scripts/sync-skills.test.mjs instrumentation/test/delivery.test.mjs skills/issue-to-pr/scripts/observe.test.mjs skills/issue-to-pr/scripts/watch.test.mjs
```

Two source-review passes and the one extra opinion preceded these hosted repairs. Publication skips another source review or extra opinion, and the hosted reviewer must cover the new head.
