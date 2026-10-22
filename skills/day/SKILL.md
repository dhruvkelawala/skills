---
name: day
description: Use when the user says goodnight or that they are wrapping up for the day, invokes /day night, or replies to the goodnight list with "yes", a change to a line, or "go on". Lists every T3 thread waiting on the user or gone quiet, suggests continue or stop for each run, and after the reply stops the chosen runs cleanly and records them for the morning report.
---

# Day

The day has two fixed anchors, a morning report and a goodnight check, and this skill owns both. This file covers the goodnight check, which is night mode.

Invoke as `/day night`, or say "goodnight". The T3 tools see the threads of the T3 server this thread runs on, so start the check from a thread on the machine where T3 runs new threads.

The user often reads the list on a phone. Put the answer first, and link each thread as `[title](t3-thread://v1/<threadId>)` with the `threadId` exactly as T3 returns it, so it opens in T3. Leave local paths out of every message.

## 1. Gather the threads

1. List every project with `t3_project_list`, and each project's active threads with `t3_thread_list` and `settled: false`. Follow `nextCursor` until it is null. Leave out this thread and archived threads. Subagent threads stay out, since their parent stands for them.
2. Read each thread with `t3_thread_read`, keeping its status, `activeRunId`, `pendingRequestCount`, `branch`, `worktreePath`, `pullRequests`, `updatedAt` and its last few messages. When the thread is an `/issue-to-pr` build, its run record at `~/.agent/issue-to-pr/<repo>/<issue>.md` gives its `stage` and `repairs`.
3. Put each thread in the first group that fits:
   - **Runs** keep working tonight without the user. A turn is `preparing`, `queued`, `starting` or `running`, or the thread watches an open PR, which its last message says.
   - **Waiting on you** threads need the user's move next. A request is pending, the status is `waiting`, or the last message asks for the user's word, such as an answer, a review, "land", "post", "more" or a one-way door.
   - **Gone quiet** threads stopped without finishing and without asking. The status is `failed` or `interrupted`, or the last message ends partway through the work.
   - **Done** threads finished with nothing asked of the user, such as an answer given or a PR merged.

   A snoozed thread is listed only as a run, since the user put its questions off. A run with no update for over an hour has also gone quiet. Keep it under runs, and say so in its reason.

**Complete when:** every active thread on the server, apart from this one, is in exactly one group.

## 2. Suggest continue or stop

Give each run a suggestion and a reason short enough to check at a glance:

- **stop** when the run needs a machine or service that sleeps overnight, such as a laptop, a network only that laptop joins, a device or simulator on it, or a service that shuts down at night. Name what it needs.
- **stop** when the run has gone quiet, or when the strain line names it as the biggest cause.
- **continue** when the run can finish without the user. Say what is left, such as "CI running, 7 repairs left".

A run that continues keeps the day's rules and its remaining repairs. It gets no separate night budget.

**Complete when:** every run has a suggestion and a reason.

## 3. Check the strain

Run `node <skill-dir>/scripts/strain.mjs`, where `<skill-dir>` is the folder holding this file. It prints the strain line only when the volume holding the home folder has under 50 GB free or memory pressure is at warning or worse, naming the biggest cause of each, and prints nothing otherwise. Finding the biggest folder can take a few minutes on a full disk. When it exits with code 2, a reading failed, so add one line saying the strain check could not run, with its error.

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
