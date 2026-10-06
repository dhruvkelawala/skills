---
name: how
description: Use for /how, a question about how code or a PR works, or a question about where a change should live. Gives a short answer that traces one real input through the code. For a full PR review use pr-review; for why code took its shape use why.
---

# How

Answer a "how does this work" or "where should this go" question from the real code. Lead with the answer, trace one concrete input, and stop. This skill reads code and changes no files.

## 1. Pick the target

- A question names the target. If it could mean two things, say which one you picked in one line and go on.
- A bare `/how` while the conversation holds a list, such as a PR stack or a review queue, means the next item after the last one explained. Name that item in your first line.
- A bare `/how` with no list means the thing discussed last.
- For a PR, read the code at its head commit. Use the PR's local worktree if one exists, with its absolute paths. Otherwise use `gh pr diff <n>` and `git show <head-sha>:<path>`.

Then choose one input to trace: a real request, command, event, or record. Take it from a test, a fixture, or the PR description before inventing one.

**Done when** you can name the target and the one input you will trace.

## 2. Trace the input

Start where the input enters the code, such as a route, a CLI command, an event handler, or a job. Follow the real calls until the input produces its result: a response, a write, an event, or a render. Open every function you cite, because names and folders can mislead. Note which module owns each piece of state along the way.

Do the trace yourself by default. When the question spans several subsystems and the user asks for depth, split it into two to four parts. Hand each part to a helper agent with the `research` role: on Pi or SumoCode spawn role `research`; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. Each helper returns its hops as `path:line` with one sentence each. With no helper available, trace the parts yourself and say so. Open each hop a helper reports before you cite it.

**Done when** every hop has a `path:line` you opened, and every link you could not confirm is marked unverified.

## 3. Placement and design questions

Skip this step unless the user asked where something belongs or how to build it.

For placement, find the nearest existing feature that does something similar, and copy its pattern. Name three things:

- The owner: the file or module that should hold the new state and logic. Decide it by following imports and calls, not folder names.
- Where it registers: the line that wires it in, such as a route table, a plugin list, or a command registry.
- One tradeoff, or the condition that would change the answer.

For a design, list the parts it adds (processes, services, packages, queues, caches, layers) and match each part to a requirement the user stated. When a part serves no requirement, call it over-engineering, and describe the design without it. Present the smallest design that meets the requirements first.

**Done when** the answer names an owner, a registration line, and a tradeoff, and every part of a proposed design maps to a requirement.

## 4. Write the answer

Use this shape and these headings, so that other skills such as `pr-review` can embed the answer as it is. Drop a section that would be empty.

```md
**Answer.** Two to four sentences that answer the question directly.

**Trace.** <the input, in one line>
1. `path:line`. What happens here, in one sentence.
2. `path:line`. The next hop.

**Where it lives.** Owner, where it registers, and one tradeoff. Placement and design questions only.

**Watch out.** Surprises, failure paths, over-engineering, and unverified links. One line each, at most three.
```

Aim for 300 to 600 words. Go longer only when the user asks for depth. Write plain words, as one engineer explains code to another. Use the repo's own names, and define a new term in the sentence where it first appears. Point with `path:line` instead of pasting code, and quote a few lines only when the exact text matters.

**Done when** the answer comes first, the trace follows one input, every pointer is a `path:line`, and the length is within 600 words unless the user asked for depth.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@e5a8186. Upstream license: [LICENSE](LICENSE).
