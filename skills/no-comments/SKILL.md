---
name: no-comments
description: Review comments with Comment Sicko, remove accepted noise, and offer structural encodings for claimed constraints. Use when the user invokes /no-comments or asks to remove unnecessary comments.
---

# No comments

Invoke as `/no-comments [files or diff range] [--report-only]`.

## 1. Pin scope

Use the caller's files or diff. Otherwise resolve the repo's default branch and review its merge-base-to-HEAD diff plus staged and unstaged changes. Ask if the base is unknown. Include nearby code for evidence, not as permission to widen the edit scope.

**Reversible default:** preserve every `ponytail:` comment and report each as a candidate encoding, including its ceiling and upgrade path. Only an explicit request to disable this exemption makes them ordinary review candidates.

## 2. Review read-only

Read [Comment Sicko](references/comment-sicko.md) completely. Resolve its absolute path, then spawn on hosts exposing Pi `subagent_spawn`:

```text
subagent_spawn {
  name: "comment-sicko",
  role: "review",
  worktree: false,
  working_dir: "<absolute repo path>",
  prompt: "Read <absolute skill path>/references/comment-sicko.md and follow it. Scope: <exact files or diff command>. Ponytail exemption: enabled. Report only; make no edits."
}
```

Pass the caller's exemption choice instead of `enabled` when overridden. The prompt file is the source of reviewer policy; do not copy its rules into the spawn. The role expresses read-only intent, not a sandbox. If subagents are unavailable, run the same prompt inline and label the report `inline`. After spawning, continue independent work or end the turn; consume the delivered result before applying findings.

## 3. Validate and act

Check every proposed deletion against the exception list and scoped code. Look up suppression rules; a suppression of a faulty/style-only rule is different from suppressing a real correctness check. Trace callers when a claimed constraint is unclear. Reject unsupported flags, scope escapes, protected deletions, and application-code edits. Rerun once with the rejection reason; a second invalid report leaves the review incomplete.

In `--report-only`, stop at findings and offers: zero edits. Otherwise remove only accepted comment noise. `MUST KILL` names a reshape target, not permission to delete intentional code. Propose the smallest root-cause rename, extraction, type, or test; obtain approval before changing behavior or broadening scope, then run relevant verification.

## 4. Offer encodings

For every comment claiming a constraint (`do not remove`, fixed wording, coordination requirements, safety bounds), and every exempt `ponytail:` comment, offer the cheapest enforceable encoding. Follow `/promote`'s ladder: **codebase → static analysis → rules → skills → style guide**. Prefer a type, rename, canonical helper, test, or lint rule over more prose; use later rungs only when earlier ones cannot hold the lesson. This ladder works without `/promote` installed.

Wait for approval to encode. Delete the constraint comment only when the approved encoding actually enforces it; otherwise retain it and report the unenforced constraint. Proven external exceptions may still need prose after encoding.

## Report

Scope and reviewer mode; proposed/applied deletion counts; keeps with exact exceptions; scoped `MUST KILL` targets; each ponytail candidate and encoding offer; approved encodings, verification, reruns, and unresolved constraints. Never call a report-only review an applied cleanup.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
