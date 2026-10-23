# day: the morning report, at f3cfb27

`node --test skills/day/evals/day.eval.mjs` from the repo root, at `f3cfb27` (base `c63b510`). Headless Claude Code runs the skill; gh, T3's MCP server and the disk and memory readings are faked at the outer boundary.

```text
✔ the report has the seven sections in order, each with its lines, and leaves out an empty one
✔ the report starts no build; the reply starts one /issue-to-pr thread per build it names
✔ the first PR in the review queue has its prep and its guide ready when the report posts
ℹ tests 3  ℹ pass 3  ℹ fail 0
```

The world (skills/day/evals/fixture.mjs): maker owns maker/app. #31 (unblocks #35), #32 and #33 are ready; #35 is blocked by #31; #34 is unlabelled with a "What's missing" section. A teammate's PR #7 and a layer #5 on it ask for maker's review. maker's PR #20 has been quiet for 20 days. No PR has late comments, so that section must be left out. 38 GB free on disk. Last night's record stopped two threads; one has run since. A record from 3 days ago stopped a third.

## Turn 1: `/day morning`

T3 calls, in order (the fake server's log):

```text
+0.0s  orchestrator_capabilities
+0.5s  t3_thread_read  thread-stopped
+0.5s  t3_thread_read  thread-restarted
+5.6s  delegate_task  axis=prep PR=#7 model=<teammate-prep job> mode=async
+8.1s  task_status
+8.1s  (prep child collected: prep record written for #7 at its head, guide finished)
+11.0s  read_pull_request_guide  #7 state=written guideHead=7e57c0de7e57c0de7e57c0de7e57c0de7e57c0de (PR head 7e57c0de7e57c0de7e57c0de7e57c0de7e57c0de)
```

No `t3_thread_launch` in this turn. The prep record the child left, `~/.agent/pr-review/app/7.md`:

```text
# Prep record: maker/app#7

head: 7e57c0de7e57c0de7e57c0de7e57c0de7e57c0de
patch ID: 0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f
reviewers reported: Standards, Spec, second opinion
guide: written for 7e57c0de7e57c0de7e57c0de7e57c0de7e57c0de

## Findings
- P1, second opinion, src/retry.js:12: the loop retries a 4xx forever. Sorted: P1.
- P2, Standards, src/config.js:1: the retry count is a bare number. Sorted: style and smell.

## Draft
Intro: https://github.com/maker/app/pull/7. The tour is in the Guide tab. withRetry wraps fetchJson and retries a 503 three times.
Wrap-up: P1 at src/retry.js:12 (second opinion). Suggested verdict: request changes, for the P1.
```

The report, as posted:

```md
Review prep for app#7 is running in the background. The GitHub lists, last night's stop and the strain check are already in. I'll wait for the prep, then post the report.

Morning. 3 builds to start, 2 PRs wait on your review, 1 run stopped last night.

**Builds to start**
1. [app#31: Rate-limit the export endpoint](https://github.com/maker/app/issues/31) · unblocks 1 issue
2. [app#32: Add a --dry-run flag to import](https://github.com/maker/app/issues/32) · ready 9 days, the oldest in app
3. [app#33: Show the row count after export](https://github.com/maker/app/issues/33) · ready 4 days

**Almost ready**
4. [app#34: Onboarding loses people on step two](https://github.com/maker/app/issues/34) · missing: which screen loses people

**Review queue**
5. [app#7: Retry fetches on a 5xx](https://github.com/maker/app/pull/7) · teammate · 67 lines · prepped: 1 P1 (retries a 4xx forever), 1 P2, tour in its Guide tab
6. [app#5: Log each retry](https://github.com/maker/app/pull/5) · teammate · 12 lines · sits on #7

**Going stale**
7. [app#20: Move the config loader to TOML](https://github.com/maker/app/pull/20) · quiet 20 days

**Stopped last night**
8. [Build #12: cache layer](t3-thread://v1/thread-stopped) · stopped at stage 2, building criterion 2 of 3

Strain: 38 GB free on disk, biggest ~/Library (300 GB, of which ~/Library/Developer 120 GB).

Reply with the builds to start, such as "start 1 and 3". `/pr-review https://github.com/maker/app/pull/7` reviews line 5 from its prep, and "go on 8" restarts the stopped run.
```

## Turn 2: the reply `start 1 and 3`

```text
+26.4s  t3_project_list
+30.2s  t3_thread_list  project=project-app titleContains="Build #31:"
+30.5s  t3_thread_list  project=project-app titleContains="Build #33:"
+33.6s  t3_thread_launch
{
  "title": "Build #31: Rate-limit the export endpoint",
  "message": "/issue-to-pr https://github.com/maker/app/issues/31",
  "projectId": "project-app",
  "workspaceStrategy": {
    "type": "worktree",
    "baseRef": "main",
    "branch": "feat/31-rate-limit-export",
    "startFromOrigin": true
  }
}
+34.6s  t3_thread_launch
{
  "title": "Build #33: Show the row count after export",
  "message": "/issue-to-pr https://github.com/maker/app/issues/33",
  "projectId": "project-app",
  "workspaceStrategy": {
    "type": "worktree",
    "baseRef": "main",
    "branch": "feat/33-export-row-count",
    "startFromOrigin": true
  }
}
```

The reply, as posted:

```md
Both builds have started. Each runs `/issue-to-pr` in its own worktree off `main`:

- [Build #31: Rate-limit the export endpoint](t3-thread://v1/launched-1)
- [Build #33: Show the row count after export](t3-thread://v1/launched-2)
```
