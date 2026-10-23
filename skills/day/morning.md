# Morning report

The morning report puts the day's moves in one message: the builds to start, the PRs waiting on the user's review, and what happened overnight. It runs as `/day morning`, which the [10:00 scheduled task](#schedule-the-1000-report) sends every day. The user reads it on a phone as often as at a desk.

Run it from a thread on the machine where T3 runs new threads, since the T3 tools see that server's threads and the builds start there. `<skill-dir>` is the folder holding this file, and `<skills-dir>` is the real directory that holds it, `cd -P <skill-dir>/.. && pwd`.

## 1. Start the first review's prep

The report posts with the review queue's first PR already prepped, so its review can start at once. Its reviewers and its guide take minutes, so start them before anything else.

1. Run `node <skills-dir>/pr-review/scripts/queue.mjs` without `--repo`, so it covers every repository. It prints pr-review's queue as JSON, in the order to review it. When the queue is empty, go to step 2.
2. Take the first entry. Its prep record is `$HOME/.agent/pr-review/<repository name>/<number>.md`. When that record names the entry's `head`, the PR is already prepped.
3. Otherwise start its prep exactly as pr-review's background prep starts the next PR's ([pr-review step 3](../pr-review/SKILL.md#3-walk-one-pr-at-a-time), "The next PR's prep runs while the user reads"): one async `delegate_task` child on the `teammate-prep` job in `<skills-dir>/models.json`, since the queue holds none of the user's own PRs. Keep its `taskId`.

**Complete when:** the queue is read, and its first PR is prepped or its prep child is running.

## 2. Gather the rest

While the prep runs, gather each section's lines.

1. **The GitHub lists.** Run `node <skill-dir>/scripts/morning.mjs`. It prints `builds`, `almostReady`, `stale` and `lateComments` as JSON, and its header says what each one holds and in what order. When it exits with code 2, a reading failed, and the report says so in one line with the error, in place of those four sections.
2. **Stopped last night.** Read the newest [night record](SKILL.md#the-night-record) in `~/.agent/day/` written in the last 24 hours. Its name holds the date and time it was written. After a night with no goodnight check there is none, and nothing is listed. For each line under its "Stopped" heading, read the thread with `t3_thread_read`. A run in its `recentRuns` requested after the line's stop time means the thread has restarted, whoever restarted it, so leave that line out.
3. **The strain line.** Run `node <skill-dir>/scripts/strain.mjs` as [night mode's step 2](SKILL.md#2-check-the-strain) says, with a command timeout of at least 6 minutes.
4. **A reason on each line.** For each build the report lists, write why it ranks there in a few words, from what it unblocks, its repository and its age, such as "unblocks #35". For each almost-ready issue, name its first gap. For each PR with late comments, say what the comments ask.

**Complete when:** you hold the four lists or the line saying they could not be read, the stopped lines, and the strain line or nothing.

## 3. Post the report

1. When step 1 started a prep child, wait for it with `task_status`. When it failed, prep the PR yourself with pr-review's steps 1 and 2.
2. Check the prep record names the PR's head, and read the PR's guide with `read_pull_request_guide`. The guide is ready when it is written for that head. While its run is `Running`, wait a minute and read it again. The PR has no guide when guides are off, its run is `Failed`, or it is still running about ten minutes after the prep began, and its line says why.
3. Post the report in this shape:

````md
Morning. 3 builds to start, 2 PRs wait on your review, 1 run stopped last night.

Builds to start
1. [app#31: Rate-limit the export endpoint](https://github.com/<owner>/app/issues/31) · unblocks #35
2. [app#32: Add a --dry-run flag to import](https://github.com/<owner>/app/issues/32) · ready 9 days, the oldest in app
3. [app#33: Show the row count after export](https://github.com/<owner>/app/issues/33) · ready 4 days
And 12 more ready to build.

Almost ready
4. [app#34: Onboarding loses people on step two](https://github.com/<owner>/app/issues/34) · missing: which screen loses people

Review queue
5. [app#7: Retry fetches on a 5xx](https://github.com/<owner>/app/pull/7) · teammate · 67 lines · prepped: 1 P1, tour in its Guide tab
6. [app#5: Log each retry](https://github.com/<owner>/app/pull/5) · teammate · 12 lines · sits on #7

Going stale
7. [app#20: Move the config loader to TOML](https://github.com/<owner>/app/pull/20) · quiet 20 days

Late comments
8. [app#81: Retry budget](https://github.com/<owner>/app/pull/81) · merged 3 days ago · alice says the empty case breaks on main

Stopped last night
9. [Build #12: cache layer](t3-thread://v1/<threadId>) · stopped at stage 2, building criterion 2 of 3

Strain: 38 GB free on disk, biggest ~/Library (300 GB, of which ~/Library/Developer 120 GB).

Reply with the builds to start, such as "start 1 and 3". `/pr-review https://github.com/<owner>/app/pull/7` reviews line 5 from its prep, and "go on 9" restarts a stopped run.
````

- The sections come in this order, under these names. Leave out a section with nothing in it, and its count in the first line.
- Number every line in one sequence, so a reply can name any line.
- **Builds to start** and **Going stale** list their first 10 in the script's order, then count the rest in one line.
- **Review queue** lists every PR in the queue's order. The first one's line gives its prep: the findings by priority and where its tour is, or why it has no guide. If that PR changes before its review, pr-review preps it again, because its prep record no longer names the PR's head. The last line offers `/pr-review <its URL>`, which reviews it from its prep in this thread. A bare `/pr-review` reviews this thread's own branch, and `/pr-review queue` walks only this project's queue, so the report offers neither.
- Link each issue and PR by its GitHub URL, which for a PR opens T3's PR panel beside the thread, and each thread as `[title](t3-thread://v1/<threadId>)` with the `threadId` exactly as T3 returns it. Never link a local file or localhost.
- The last line names only the replies that apply to this report.

Then end the turn. The report starts nothing: a build starts only when the user's reply names it, and with no reply nothing starts.

**Complete when:** the first PR's prep record names its head, its guide is written for that head or its line says why it has none, and the report is posted with no thread started.

## 4. Start the builds the reply names

Read the reply against the report's numbers:

- Line numbers or issue numbers from **Builds to start**, as in "start 1 and 3", "1, 3" or "#31", start those builds. "all" starts every listed build.
- A line from another section starts nothing, and the reply says so. "go on" with a stopped line restarts it, as ["go on"](SKILL.md#go-on) says.
- When the reply leaves a line unclear, ask about that line once, and start nothing until the answer comes.

For each build:

1. **Find its project.** Call `t3_project_list` and follow `nextCursor` until it is null. The build's project is the one whose `workspaceRoot` is a checkout of the issue's repository, which `git -C <workspaceRoot> remote get-url origin` names. With no such project, its reply line says so and nothing starts for it.
2. **Check it hasn't started.** When `t3_thread_list` in that project with `titleContains: "Build #<n>:"` finds a thread, the build has started since the report, so link that thread and launch nothing.
3. **Launch its thread** exactly as issue-to-pr launches a build's thread ([issue-to-pr stage 1, item 3](../issue-to-pr/SKILL.md#1-pin-the-contract), "To launch a build's thread"), with the base branch set to the repository's default branch from `gh api repos/<owner>/<repo> --jq .default_branch`. Add the project's `projectId`, set `title` to `Build #<n>: <short title>`, and set `message` to `/issue-to-pr <issue URL>`, so the thread knows the repository. The launch has no retry key, so after an error or a lost response, check `t3_thread_list` before calling it again.

Then reply with one line per build: its thread as `[Build #<n>: <short title>](t3-thread://v1/<threadId>)`, or why it has none.

**Complete when:** each build the reply named has exactly one thread running `/issue-to-pr`, or a reply line saying why it has none.

## Schedule the 10:00 report

A scheduled task runs on the T3 server of the thread that creates it, and each run posts into that thread. Make one thread for the reports on the machine where T3 runs new threads, and from it call `schedule_task` with:

- `prompt`: `/day morning`
- `schedule`: `{"type": "fixed_time", "timeOfDay": "10:00"}`, passed as an object, not a string. With no `weekdays` it runs every day, at the machine's local time.
- `title`: `Morning report`

Leave `bindToCurrentThread` at its default, so the reports and the replies that start builds stay in that thread. Tell the user the `nextRunAt` the tool returns.
