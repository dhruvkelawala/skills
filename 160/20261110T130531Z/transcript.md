# Issue 160 CLI evidence

Head: `a3153b700af483a6dde94cc8edd28c5b4597418b`. Tree: `6905aadfcd2b8cc27fc9b2229f99efd53962513c`.
Base: `e7b321c30ef36eb52bb9177020dc60a1d1c42182`.

These transcripts run the actual ship CLI against a real temporary Git history. The external GitHub executable is a deterministic fixture. No live PR is merged. `landable: [7]` means the landing plan admits the pinned PR; `landable: []` means it refuses it.

The base changes 301 generated files. The PR changes sample.txt. A later base commit renames sample.txt. Each invocation fetches real Git objects through a fixture URL rewrite. Recovery pins the base commit reported by the GitHub fixture, so a mirror that cannot supply that commit stays closed.

Reproduce from the repository root with the linked demo.mjs:

```sh
node demo.mjs skills/ship/scripts/ship.mjs
```

Before, run the same demo with ship.mjs extracted from the base commit.

## Before

```text
Uncapped compare, no shared file
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [
    7
  ],
  "refusal": null
}
Capped compare, 301 base-only files, no shared file
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 1 commit this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, real overlap via old rename name
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, origin identity cannot be confirmed
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, Git fetch fails on a conflicting ref namespace
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, origin cannot supply GitHub base tip
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
```

## After

```text
Uncapped compare, no shared file
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [
    7
  ],
  "refusal": null
}
Capped compare, 301 base-only files, no shared file
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [
    7
  ],
  "refusal": null
}
Capped compare, real overlap via old rename name
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks that change sample.txt; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, origin identity cannot be confirmed
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks; the compare file list was cut off at 300 files and the complete file list could not be read; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, Git fetch fails on a conflicting ref namespace
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks; the compare file list was cut off at 300 files and the complete file list could not be read; rebase onto main, push, wait for required checks, then run again"
}
Capped compare, origin cannot supply GitHub base tip
$ node ship.mjs run 7 --repo fixture/repo --json
{
  "landable": [],
  "refusal": "main has 2 commits this head lacks; the compare file list was cut off at 300 files and the complete file list could not be read; rebase onto main, push, wait for required checks, then run again"
}
```
