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
repairs: <used>/<budget>   (only repairs.mjs changes it)
autoreview: <engine and model>, tree <hash>, clean | <n> fixed | skipped: <reason>
review_policy: conditional-v1   (opt-in at contract pinning only; absent keeps the existing policy)
autoreview_plan: <single-line JSON written by autoreview-plan.mjs, separate from autoreview outcome>
pr: <URL or none>
spec_mode: stack | one-pr   (a spec's own record)
thread: <the spec thread's id>   (a spec's own record)
spec: <spec URL>   (a ticket a spec thread started)
draft: yes | no   (from stage 5; yes until the user's "done" in stage 8)
guide: written for <head> | none: <reason>   (once stage 7 checked it)
land: held at <head>, patch <fingerprint> | --merge | dropped at <head>: <reason>   (only land.mjs writes it)
```

Stage reports go below the header, appended in order:

- the contract
- the brief
- the build report
- each review pass: the tree it reviewed, or the skip and its reason, each reviewer's actual engine and model, any availability fallback and coverage limit, and every finding with its priority, source, the head it was reviewed at, and its repair commit or rejection reason
- the evidence links, each with the head it was captured at
- the verifier's verdict and the rule B reason it ran, or why it was skipped
- each verification disposition, `reused`, `deferred` or `new`, with its reason, published head, criteria source and evidence; for a new child, its task, actual model and effort; for an interrupted attempt, the cancellation reason and validity limits of retained partial evidence
- the user's review: each comment with its fix commit or answer
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
3. When GitHub reports the PR as MERGED, clean up as [on merge](pr-thread.md#on-merge) says, which records `merged`, and stop. When it reports CLOSED, record `blocked: PR closed` and stop.
4. When the live head differs from the record, set `stage` back to the last stage whose head still matches, and continue from that stage.

**Complete when:** the record's stage, head and tree match live state.

## Conditional-v1 pilot

Enroll only when the user or pinned contract explicitly chooses this pilot. Record the enrollment at contract pinning; existing records remain outside it. Preserve the `## Contract` section as the reviewable contract, separate from later `##` stage reports. The planner stores its exact text along with Git IDs, rather than introducing another fingerprint.

After both pass-1 axes finish, write a facts JSON file outside the checkout. Populate it from their actual reports and repository inspection, with this shape:

```json
{
  "reviews": [
    {
      "axis": "standards",
      "reviewer": "independent task ID for standards",
      "status": "completed",
      "family": "codex",
      "model": "actual model reported by the reviewer",
      "base": "full pinned base SHA",
      "head": "full reviewed head SHA",
      "tree": "full reviewed tree SHA",
      "contract": "exact trimmed text of the reviewed Contract section",
      "access": { "repository": true, "contract": true, "standards": true, "tests": true },
      "coverage": "full",
      "fallback": false,
      "risks": { "authority": false, "storedData": false, "money": false, "productionSwitch": false, "oneWayDoor": false }
    },
    {
      "axis": "spec",
      "reviewer": "different independent task ID for spec",
      "status": "completed",
      "family": "claude",
      "model": "actual model reported by the reviewer",
      "base": "full pinned base SHA",
      "head": "full reviewed head SHA",
      "tree": "full reviewed tree SHA",
      "contract": "exact trimmed text of the reviewed Contract section",
      "access": { "repository": true, "contract": true, "standards": true, "tests": true },
      "coverage": "full",
      "fallback": false,
      "risks": { "authority": false, "storedData": false, "money": false, "productionSwitch": false, "oneWayDoor": false }
    }
  ],
  "openP0P1": false,
  "contractRisks": { "authority": false, "storedData": false, "money": false, "productionSwitch": false, "oneWayDoor": false },
  "configuration": { "complete": true, "paths": [] },
  "hostedReviewer": { "configured": true, "available": true, "bot": true, "login": "actual-bot-login", "source": "pr-watch configuration source and availability evidence" },
  "userRequested": false
}
```

These are attestations, not defaults. Ask both independent reviewers to report their actual model family/model, base/head/tree, contract, access, coverage, fallback and risk judgments. Keep their reports in the run record. A blank report or lack of findings does not establish low risk. Use `incomplete` for an unfinished axis. A completed fallback still satisfies mandatory source review under model-policy, but retains the extra opinion. The two axes must use distinct contexts and agree on the reviewed Git basis.

`configuration.complete` means repository inspection accounted for all dependency and toolchain configuration, including nested projects, runtime declarations, CI, containers and build setup. List all project-specific configuration paths in `configuration.paths`; the helper also recognizes common configuration names. If configuration is unknown, use `complete: false`. The helper computes changed paths, including deleted and renamed configuration, against the pinned base. It does not trust an asserted empty diff.

The contract and both reviewers must explicitly rule out each risk. This guard covers authority, stored data, money, production switches and one-way doors even when ship's proof-dependent rule B would not require verification. Unknown or conflicting judgments retain the opinion. Resolve hosted bot review through pr-watch's existing configuration precedence, and record evidence that the configured bot is available for this workflow, including draft support when applicable. A human reviewer alone does not qualify. Preserve that configuration; never add or change a reviewer to obtain eligibility. Record whether the user asked for an extra opinion.

Run from the checkout:

```bash
node <issue-to-pr>/scripts/autoreview-plan.mjs stage3 <record> <facts.json>
```

The JSON result is `run`, `skip` or `blocked`, with reason codes and `basis` holding computed base/head/tree, changed paths, dirty status, exact contract and explicit facts. The helper writes only `autoreview_plan`; it never launches a model or marks a review completed. Check `decision`, because operational blockers are JSON results. A command usage error exits 2.

- `eligible` permits an intentional skip. Record `autoreview: skipped: conditional-v1, eligible`, with the plan's basis in the stage report. Feed `aprArgs` to publication. Do not claim a clean extra opinion.
- `source-review-incomplete` and `accepted-findings-open` block. Complete mandatory review or its repairs; autoreview cannot substitute.
- Other reasons retain the opinion. Post the concrete triggers before running the existing helper, passing the returned `prompt` through its existing `--prompt` argument.
- Same-basis retries return the saved plan. Recompute before stage 3 completes when the tree, contract or facts change. Changed pass-1 trees retain the opinion in either lane. Changed contracts retain it on reassessment; preserve the earlier decision in the stage report before replacing its header.
- `opinion-already-completed` preserves a completed extra opinion and avoids repeating it. Keep the original reviewed base/head/tree and disclose subsequent repairs. A failed attempt records `autoreview: incomplete: <reason>` and may retry availability handling. A completed outcome uses exactly `<claude|codex> <actual model>, tree <full SHA>, clean | <n> fixed`.

Publication uses `autoreview-plan.mjs publish <record|-> [--skip-review]`. Explicit skip wins over clean-result reuse. Without it, only an actual completed clean result on the current tree in a clean checkout is reused. Plan reasons and skipped or incomplete outcomes cannot satisfy reuse. Issue-to-pr always passes `--skip-review` after an intentional stage-3 skip and after later repairs to a completed opinion; standalone APR and pr-watch defaults remain unchanged.

### Measurement and rollback

Use existing run records. For each enrolled run, record the repository, actual author family/model, actual source-review and extra-opinion families/models, decision and reviewed basis. Count total enrolled runs, retained opinions and actual eligible skips separately. `opinion-already-completed` is not an actual pilot skip. Time retained opinions from helper start to terminal result, including availability attempts, and record incomplete attempts separately. For every downstream accepted P0/P1, record its source, discovery head, repair, and whether it was already present and discoverable in the stage-3 diff. Keep later repairs marked not re-reviewed.

Review the pilot after ten actual skips across at least three projects, reporting Claude and Codex author threads separately. Ten quiet skips are an operational checkpoint, not a catch-rate estimate or evidence of exact counterfactual time saved. This PR prepares the pilot; reaching the checkpoint is not a condition of publication or merge.

Pause enrollment and restore the previous policy if a skipped run receives an accepted P0/P1 already present and discoverable in its stage-3 diff, a recorded skip basis proves false, mandatory coverage is missing, or publication launches a skipped opinion or reports one as clean. These are conservative stop signals; they do not prove what autoreview would have found. Record the stop reason and any run leaving the pilot. Reverting this bounded change restores the previous policy. Preserve historical decisions, outcomes and downstream findings.

Resume retains the policy and saved decision, or explicitly records departure. A subsequent standalone pr-watch records `pilot_exit: standalone pr-watch at <head>, <UTC time>` because that entry point can run autoreview on repair publication. No standalone defaults change.
