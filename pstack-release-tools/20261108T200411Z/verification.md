# Pstack release tools verification

Source: cursor/plugins@1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def.

Base: 7582ef85c52d6bcdfcc0befcfd4aa89db4f7273b
Head: 61b719dfc80a588396ba0036cf03fe089b25c66b
Candidate tree: 8c531fd40e3a6bc36438dc22b28f26706d7bdaca

## Before (pinned upstream helper)

`bash log.sh <log> frame <formula> <reason> proof.txt open`

```text
exit 0
'ts\tphase\tdecision\twhy\tevidence\tresult\n2026-11-08T20:03:38Z\tframe\t +SUM(A1)\tBecause we checked\tproof.txt\topen\n'
```

Mismatched existing header, same invocation shape:

```text
exit 0

'other\tschema\nkeep\tthis\n2026-11-08T20:03:38Z\tcheck\tAppend\tRequested\tproof.txt\topen\n'
```

## After (adapted helper)

`bash log.sh <log> frame <formula> <reason> proof.txt open`

```text
exit 0
"ts\tphase\tdecision\twhy\tevidence\tresult\n2026-11-08T20:03:38Z\tframe\t' +SUM(A1)\tBecause we checked\tproof.txt\topen\n"
```

Mismatched existing header, same invocation shape:

```text
exit 1
not a decision log: /var/folders/gx/hrgjtdbj6mg775bn0yy842yr0000gn/T/pstack-cli-evidence-74d00uin/after.tsv
'other\tschema\nkeep\tthis\n'
```

## Repository checks

`node --test`: 350 passed, 0 failed, 0 skipped.
`python3 skills/cleanup/scripts/test-worktree-audit.py`: PASS.
`python3 skills/cleanup/scripts/test-artifact-audit.py`: PASS.
`bash -n skills/show-me-your-work/scripts/log.sh`: passed.
Frontmatter, relative links, licence bytes and TSV template match: passed.
`git diff --cached --check`: passed.

## Independent review

APR helper: Claude, claude-opus-5-5, local review against base 7582ef85c52d6bcdfcc0befcfd4aa89db4f7273b, P0-P1. Exit 0, scoped-clean. No fallback, accepted findings or rejected findings.

The reviewer could not independently see unchanged model schema guidance or T3 tool definitions. Author follow-up confirmed onClaudeThread/onCodexThread are existing models.json keys; models.test.mjs passes, and the host tool catalog includes orchestrator_capabilities and delegate_task.

## Limits

No full live arena/model batch or release-manager merge cycle was run. The smoke ran the real Bash CLI, including the system /bin/bash, without mocks. Publishing uses APR --no-watch; no merge is authorized.
