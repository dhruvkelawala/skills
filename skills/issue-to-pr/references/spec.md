# Spec mode

A spec is an issue whose open sub-issues are its tickets, ordered by their blocked-by links. `/issue-to-pr <spec>` builds every ticket in it, because starting a spec is the word to start each of its tickets. The thread it runs in is the spec thread.

Each ticket gets its own thread, its own brief and its own PR. A ticket blocked by another starts as soon as its blocker's PR is published, stacked on that PR's branch. GitHub's blocked-by count drops only when the blocker's issue closes on merge, so the spec thread tracks published PRs itself, from the tickets' run records. With `--one-pr`, the spec thread builds every ticket as one PR instead, as [one PR](#one-pr) says.

The commands below run `node <this skill's folder>/scripts/spec.mjs`. It reads GitHub through `gh api`, and each ticket's build from its run record beside the spec's.

## Pin the spec

The spec thread builds nothing, so it stays in the thread and checkout where it started. Stage 1 steps 1 and 2 have pinned the base and read the spec.

1. Write the spec's run record header, as [run record](run-record.md) shows, with `spec_mode: stack` and `thread:` set to this thread's id from `t3_thread_configuration`.
2. Run `spec.mjs tickets <record>`. It prints the spec's open tickets in build order, each with its open blockers. Append it to the contract as printed. When it reports a problem, such as a blocker in another repository or blocked-by links that form a loop, record `blocked: <problem>` and stop.
3. Finish the contract: the base, what is out of scope, and the human gates, at least the review of each PR.
4. Post the [spec's brief](#brief), then start what can start.

## Start what can start

Run this step after the brief, and again each time the thread wakes:

1. Run `spec.mjs next <record>`. It prints one line per ticket, in the contract's order, then `running` or `done`.
2. For each `#<n> starts on <branch>` line, start the ticket's build with `t3_thread_launch`. Set `message` to `/issue-to-pr <n> --spec <spec>`, adding `stack <PR>` when the line ends `stacked on <PR>`, and this run's `--merge` and `--max-repairs`. Set `workspaceStrategy` to `{"type": "worktree", "baseRef": "<branch>", "branch": "<type>/<n>-<short-description>", "startFromOrigin": true}`. Then run `spec.mjs started <record> <n> <threadId>` straight away, so that a later wake never starts the ticket twice.
3. Leave a `waits for` line alone. When a ticket's run ends blocked, only the tickets above it wait, with `waits for #<n>, which is blocked`, and the rest keep building. A ticket whose two open blockers sit in different stacks waits until one of them merges.
4. On `running`, record `stage: watching` and end the turn. Each ticket's thread wakes this one when its PR is published and when its run stops. `/issue-to-pr <spec> resume` runs this step by hand.
5. On `done`, nothing can move without the user: every ticket is waiting on them, blocked, merged, or waits for one of those. Record `stage: ready` when no ticket is blocked or waiting, otherwise `blocked: <each blocked or waiting ticket and why>`, then post the [spec's recap](#recap) and stop.

**Complete when:** `spec.mjs next` prints `done`, the record shows a thread for every ticket that started, and the recap is posted.

## Brief

The spec thread posts one brief for the whole spec, in [the brief](../SKILL.md#brief)'s shape, with three changes:

- The first line reads `Building #<spec> as a stack: <spec title>`.
- Each plan step is one ticket, `#<n> <title>`, worded as the `Tickets:` list words it.
- The last line ends `Lane: per PR`, because each ticket's build sets its own lane.

## Recap

When the spec stops, it posts one recap that covers every PR. Under the result, list every ticket on a line of its own, as `spec.mjs next` last printed it, so each PR shows with its state. Then come the five lines: `Review:` and `Evidence:` sum up what the PRs carry, and `Next:` offers `/pr-review <the stack>`, because the stack is reviewed from this thread.

`messages.mjs recap` refuses a spec's recap that leaves out a ticket, its state or its PR.

## One PR

With `--one-pr`, the spec thread builds every ticket onto one integration branch, `<type>/<spec>-<short-description>`, as one build. That branch gets the same review, evidence, PR body and watch as any other build, and one repair budget. Carry on from stage 1 step 3, with these changes:

- The header has `spec_mode: one-pr`. Run `spec.mjs tickets <record>` and append its list to the contract.
- The contract's `Acceptance criteria:` list holds every ticket's criteria, in the `Tickets:` order, each one worded `#<ticket>: <criterion>`.
- The brief's first line reads `Building #<spec> as one PR: <spec title>`, and each plan step is one ticket, as in the [spec's brief](#brief). Its lane is the build's own.
- Stage 2 builds the tickets in that order, one commit per criterion.
- The PR body follows [one PR for a spec](pr-body.md#one-pr-for-a-spec). Before stage 5 publishes it, run `spec.mjs body <record> < <body file>`, and fix the body until it passes.

## A ticket's build

A build started with `--spec <spec>` is one ticket of that spec. It runs every stage as any build does, with its own brief and its own repair budget, and records `spec: <spec URL>` in its header.

- With `stack <PR>`, its predecessor is that PR, even when other layers already sit on it, as [stacks](stacks.md) says.
- When stage 5 has published its PR, and again whenever its run stops, it wakes the spec thread. Read `thread:` from the spec's run record, `<spec>.md` beside this one, and call `t3_thread_send` with that `threadId`, `message` set to `/issue-to-pr <spec> resume`, `mode: "queue"`, and `clientRequestId` set to `<spec>-<n>-<stage>-<short head>`.
