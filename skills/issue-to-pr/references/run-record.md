# Run record

## Location

The record is `~/.agent/issue-to-pr/<repo>/<issue>.md`. `<repo>` is `gh repo view --json name --jq .name` (REST: `gh api repos/{owner}/{repo} --jq .name`), and `<issue>` is the issue number or the Linear ticket ID. Create the directory when it is missing. The path is outside every checkout, so isolated worktrees and helper agents share one record.

Only the orchestrator writes the record. Helper agents return reports, and the orchestrator appends them.

## Format

The record starts with a short header that the orchestrator rewrites in place:

```md
issue: <URL or Linear ticket>
repo: <owner/name>
mode: standalone | stacked
lane: full | light
base_ref: refs/remotes/<remote>/<branch>
base_sha: <sha>
predecessor_pr: <URL, stacked only>
stack_tracking: gh-stack | none   (stacked only)
branch: <name>
stage: contract | implemented | reviewed | verified | published | watching | awaiting-human | ready | merged | blocked: <reason>
head: <sha the stage was proven on>
tree: <git rev-parse HEAD^{tree} at that head>
repairs: <used>/<budget>
autoreview: <engine and model>, tree <hash>, clean | <n> fixed | skipped: <reason>
pr: <URL or none>
spec_mode: stack | one-pr   (a spec's own record)
thread: <the spec thread's id>   (a spec's own record)
spec: <spec URL>   (a ticket a spec thread started)
guide: written for <head> | none: <reason>   (once stage 7 checked it)
```

Stage reports go below the header, appended in order:

- the contract
- the brief
- the build report
- each review pass: the tree it reviewed, or the skip and its reason, and every finding with its priority, source, the head it was reviewed at, and its repair commit or rejection reason
- the evidence links, each with the head it was captured at
- the verifier's verdict and the rule B reason it ran, or why it was skipped
- each watch pass: its gate result, its repairs and the stage it left
- the handoff block
- the report and the recap, each time the run stops

Keep earlier passes, so that `/promote` can see a finding that recurs.

The contract lists its criteria under a line that reads `Acceptance criteria:`, one numbered line per criterion, with details such as its surface and capture on indented lines below it. The brief's plan is checked against that list.

A spec's contract lists its tickets instead, under a line that reads `Tickets:`, as `scripts/spec.mjs tickets` prints them: one numbered `#<n> <title>` line per ticket, with its open blockers on an indented `blocked by:` line. The spec's brief plans those tickets, and its recap gives each one a line. `spec.mjs started` adds a `started: #<n> in thread <id>, <UTC time>` line for each build the spec thread starts, and `spec.mjs next` reads those lines and each ticket's record beside this one.

`scripts/messages.mjs` appends the brief and each recap as a `## Brief, <UTC time>` or `## Recap, <UTC time>` section, with the text in a fenced block. Add them only through the script, because it reads those sections to find the last 10 sign-offs.

## When a record already exists

1. Read the record. If an older record exists at `$(git rev-parse --git-dir)/issue-to-pr/<issue>.md`, read it too and copy its identifiers and reports into the new record. Leave the old file where it is.
2. Run `git fetch` and compare the record with live state: `base_sha` is still reachable, the branch head exists, and, once a PR exists, `gh pr view <pr> --json state,headRefOid,baseRefName` (REST: `.state`, `.merged`, `.head.sha` and `.base.ref` from `gh api repos/{owner}/{repo}/pulls/<pr>`).
3. When GitHub reports the PR as MERGED, record `merged` and stop. When it reports CLOSED, record `blocked: PR closed` and stop.
4. When the live head differs from the record, set `stage` back to the last stage whose head still matches, and continue from that stage.

**Complete when:** the record's stage, head and tree match live state.
