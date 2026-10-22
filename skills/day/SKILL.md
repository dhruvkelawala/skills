---
name: day
description: Use when the user says goodnight or that they are wrapping up for the day, invokes /day night, or replies to the goodnight list with "yes", a change to a line, or "go on". Lists every T3 thread waiting on the user or gone quiet, suggests continue or stop for each run, and after the reply stops the chosen runs cleanly and records them for the morning report.
---

# Day

The day has two fixed anchors, a morning report and a goodnight check, and this skill owns both. This file covers the goodnight check, which is night mode.

Invoke as `/day night`, or say "goodnight". The T3 tools see the threads of the T3 server this thread runs on, so start the check from a thread on the machine where T3 runs new threads.

The user often reads the list on a phone. Put the answer first, and link each thread as `[title](t3-thread://v1/<threadId>)` with the `threadId` exactly as T3 returns it, so it opens in T3. Every link goes to a T3 thread or a web page, never to a local file or localhost.

## 1. Gather the threads

1. List every project with `t3_project_list`, and each project's active threads with `t3_thread_list` and `settled: false`. Follow `nextCursor` until it is null. Leave out this thread and archived threads. Subagent threads stay out, since their parent stands for them.
2. Read each thread with `t3_thread_read`, keeping its status, `activeRunId`, `pendingRequestCount`, `branch`, `worktreePath`, `pullRequests`, `updatedAt` and its last few messages. When the thread is an `/issue-to-pr` build, its run record at `~/.agent/issue-to-pr/<repo>/<issue>.md` gives its `stage` and `repairs`.
3. Put each thread in the first group that fits:
   - **Runs** keep working tonight without the user. A turn is `preparing`, `queued`, `starting` or `running`, or the thread watches an open PR, which its last message says.
   - **Waiting on you** threads need the user's move next. A request is pending, the status is `waiting`, or the last message asks for the user's word, such as an answer, a review, "land", "post", "more" or a one-way door.
   - **Gone quiet** threads stopped without finishing and without asking. The status is `failed` or `interrupted`, or the last message ends partway through the work.
   - **Done** threads finished with nothing asked of the user, such as an answer given or a PR merged.

   A snoozed thread is listed only as a run, since the user put its questions off. A turn that has run for over an hour with no update has also gone quiet. Keep it under runs, and say so in its reason. A thread that watches a PR is idle between PR events by design, so judge it by its PR's state.

**Complete when:** every active thread on the server, apart from this one, is in exactly one group.

## 2. Check the strain

Run `node <skill-dir>/scripts/strain.mjs` with a command timeout of at least 6 minutes, where `<skill-dir>` is the folder holding this file. On a full disk, finding the biggest folder can take over 4 minutes. The script gives up on that search at 5 minutes and still reports the free space. It prints the strain line only when the volume holding the home folder has under 50 GB free or memory pressure is at warning or worse, naming the biggest cause of each, and prints nothing otherwise. When it exits with code 2, a reading failed, so add one line saying the strain check could not run, with its error.

**Complete when:** the script has exited, and you hold its line, nothing, or the line saying it could not run.

## 3. Suggest continue or stop

Give each run a suggestion and a reason short enough to check at a glance:

- **stop** when the run needs a machine or service that sleeps overnight, such as a laptop, a network only that laptop joins, a device or simulator on it, or a service that shuts down at night. Name what it needs.
- **stop** when the run has gone quiet, or when the strain line names it as the biggest cause.
- **continue** when the run can finish without the user. Say what is left, such as "CI running, 7 repairs left".

A run that continues keeps the day's rules and its remaining repairs. It gets no separate night budget.

**Complete when:** every run has a suggestion and a reason.

## 4. Post the list and wait

Post the list in this shape. Number every listed thread in one sequence, so the user can change any line by its number. Leave out an empty group, the done line when nothing is done, and the strain line when the script printed nothing.

```md
Goodnight. 3 runs: 2 continue, 1 stop. 1 waits on you, 1 went quiet.

Runs
1. continue · [Build #63: thread per build](t3-thread://v1/<threadId>) · PR #81 waiting on CI, 7 repairs left
2. continue · [Build #64: brief and recap](t3-thread://v1/<threadId>) · building criterion 2 of 3, 10 repairs left
3. stop · [Error spike in checkout](t3-thread://v1/<threadId>) · reads prod through a laptop that sleeps tonight

Waiting on you
4. [Build #60: ticket skill](t3-thread://v1/<threadId>) · PR #79 is clean and waits for "land"

Gone quiet
5. [Explain the cache layer](t3-thread://v1/<threadId>) · failed 3 h ago on a rate limit

Done: 6 threads with nothing asked of you.
Strain: 38 GB free on disk, biggest ~/Library (300 GB, of which ~/Library/Developer 120 GB).

Reply "yes", or change a line, such as "stop 1" or "continue 3".
```

Then end the turn. The list changes nothing, and every stop, unwatch and record waits for the reply. With no reply, every run goes on under the day's rules, and the threads that wait on the user wait until morning.

**Complete when:** the list is posted and no thread has been touched.

## 5. Act on the reply

Read the reply against the numbered list:

- "yes" takes every suggestion.
- A change names lines by number and wins over the suggestion, as in "stop 1", "continue 3" or "yes, but stop 2". Any listed thread can be stopped. "continue" on a line that is not a run changes nothing.
- When the reply leaves a line unclear, ask about that line once, and act on nothing until the answer comes.

Stop each run marked stop, as [Stop a run](#stop-a-run) says, and write the [night record](#the-night-record). Then reply with one line per stopped run, saying where it stopped, and one count for the runs that continue.

**Complete when:** every line marked stop has been stopped, the night record holds every stopped and continuing run, and the reply is posted.

## Stop a run

Stop each thread marked stop in four moves, in this order:

1. **Interrupt.** When the thread had an active run in step 1, call `t3_thread_interrupt` with its `threadId`, `runId` set to that run, `reason: "Stopped by the goodnight check. Say \"go on\" to restart."` and `clientRequestId: "day-stop-<runId>"`. Pinning the run leaves alone any run the user started after the list, and the request ID makes a retry interrupt once. Then call `t3_thread_wait` with the same `runId` and a 60 second timeout, and check that the run ended as `interrupted`, `completed`, `failed` or `cancelled`. When the wait times out, read the thread once more. If it is still running, its line in the record and the reply says so.
2. **Unwatch.** Call `unwatch_pull_request` with the `threadId` and the `url` of each PR in its `pullRequests`. The PR stays linked to the thread.
3. **Save where it stopped.** Read its checkout with `git -C <worktreePath> rev-parse --short HEAD` and `git -C <worktreePath> status`, keeping the head, the count of uncommitted files, and any rebase, merge or cherry-pick that `git status` names as in progress. The worktree keeps the files as they are, and the thread picks them up when it restarts. Take where it stopped from its last message, or from its run record's `stage`, in one line.
4. **Record** it in the night record.

**Complete when:** each stopped thread's run has ended or is recorded as still stopping, each of its PRs got an unwatch call, and the night record has its line.

## The night record

The night record is `~/.agent/day/night-<YYYY-MM-DD>-<HHMM>.md`, written when the reply is acted on. When a record from the last 12 hours exists, add to it instead, so a second goodnight in one night keeps the first one's stops.

```md
# Night record, <YYYY-MM-DD> <HH:MM>

## Stopped
- <ISO time> · [<title>](t3-thread://v1/<threadId>) · PR <url, or none> · <branch> at <short sha>, <n> uncommitted files<, rebase in progress> · stopped at: <one line>

## Continued
- <ISO time> · [<title>](t3-thread://v1/<threadId>) · <the reason it continued>
```

The morning report lists, under "stopped last night", each stopped line whose thread has not run since its stop time. `t3_thread_read` shows this in `recentRuns`: a run requested after the stop time means the thread restarted, whoever restarted it.

## "go on"

"go on" with a line number or a thread, said here or in the morning report's thread, restarts a stopped run. Send the thread a message with `t3_thread_send` and `mode: "auto"`:

```text
go on: the goodnight check stopped this run at <time>, at <where it stopped>. Continue from there, and watch <PR url> again if you were watching it.
```

Reply with the thread's link. Said in the stopped thread itself, "go on" is that thread's own word, and the interrupt reason tells it why it stopped.
