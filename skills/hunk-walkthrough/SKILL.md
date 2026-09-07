---
name: hunk-walkthrough
description: Open a branch or pull request’s full changes in Hunk with a numbered, narrative code walkthrough. Inside Herdr it opens Hunk in a new tab (or a 50/50 split with `split`); in Claude Code, Codex, T3Code, or any other host it attaches to a Hunk the user launches. Use when the user asks to review, explain, or walk through a diff/PR in Hunk, including /hunk-walkthrough split.
compatibility: Requires git, gh, hunk, and node on PATH. Herdr surface control needs a Herdr-managed pane and herdr on PATH.
---

# Hunk Walkthrough

Turn a finished changeset into a guided Hunk review: one Hunk surface the user can see, the complete diff, and a small set of numbered agent notes that tell the implementation story.

## Host

Decide once, before anything else:

```bash
test "${HERDR_ENV:-}" = 1 && host=herdr || host=plain
```

- **herdr**: the agent owns the surface. It creates a Herdr tab or split, launches Hunk in it, and focuses it. Every step below applies.
- **plain** (Claude Code, Codex, T3Code Desktop, a bare terminal): the agent cannot open a pane the user can see, so the user launches Hunk and the agent attaches. Skip step 2's surface work and step 3's `herdr pane run`; follow the **plain host** notes in those steps instead. The pinned range, the ordered file stream, and the comments are identical. Arrange Hunk's file stream in that same story order so next-comment navigation advances monotonically.

## Boundaries

- This is a changeset walkthrough, not a full-codebase audit. Do not create `REVIEW.md`, a handbook, or a review branch.
- If the user asked to resolve PR feedback first, finish that loop, push the clean result, and only then open Hunk.
- Once the walkthrough starts, leave source code unchanged unless the user flags a fix.
- Preserve panes and comments you did not create.

## Mode

Herdr only. Default to `tab` mode: open Hunk in a new Herdr tab in the caller's workspace. If the invocation includes a standalone `split` token, as in `/hunk-walkthrough split`, use `split` mode: open Hunk in a 50/50 pane split beside the caller instead. A PR number, branch name, or other work item may follow the mode token. On a plain host the token is ignored.

## 1. Pin the changeset

1. Confirm a clean worktree with `git status -sb`. If dirty files are part of unfinished work, finish or clarify them before presenting the diff.
2. For any PR — open, closed, or merged — read immutable endpoint OIDs and the PR number:

```bash
gh pr view <pr> --json number,url,state,baseRefName,baseRefOid,headRefName,headRefOid,mergeStateStatus
```

Do not assume the PR branch still exists or that local `HEAD` is its head. Fetch GitHub's pull ref plus the base history, then pin both exact OIDs under private non-branch refs:

```bash
git fetch origin <base-ref-name> refs/pull/<pr-number>/head
git cat-file -e '<base-ref-oid>^{commit}' || git fetch origin <base-ref-oid>
git cat-file -e '<head-ref-oid>^{commit}' || git fetch origin refs/pull/<pr-number>/head
git update-ref refs/herdr/pr-<pr-number>-base <base-ref-oid>
git update-ref refs/herdr/pr-<pr-number>-head <head-ref-oid>
test "$(git rev-parse refs/herdr/pr-<pr-number>-base)" = "<base-ref-oid>"
test "$(git rev-parse refs/herdr/pr-<pr-number>-head)" = "<head-ref-oid>"
```

Set the review range to `refs/herdr/pr-<pr-number>-base...refs/herdr/pr-<pr-number>-head`. These refs change only Git metadata; never check out or rewrite source files to reconstruct a merged PR.

3. For a non-PR branch/range, resolve both endpoints to immutable commit OIDs using the user's target or the merge-base with the default branch, and use `<base-oid>...<head-oid>`.
4. Record `review_range`, the changed-file list, and diffstat from `git diff "$review_range"`. Done when the immutable range names exactly the intended changes, including a merged PR whose source branch was deleted.

## 2. Establish the surface

**Plain host:** resolve the bundled files below and take the session snapshot, then skip the rest of this step.

Resolve these bundled files relative to this `SKILL.md` and keep their absolute paths for the run:

- `extensions/walkthrough-order.ts` — passive Hunk transform that applies an exact, unexpired file order
- `scripts/write-order.mjs` — validates and writes that order under the checkout's private Git metadata
- `scripts/find-session.mjs` — snapshots Hunk sessions and identifies the one this run launched

Never substitute a repo-controlled extension. Hunk extensions execute with the user's permissions.

**Herdr:** read the installed CLI rather than assuming syntax:

```bash
herdr tab
herdr pane
herdr tab list --workspace "$HERDR_WORKSPACE_ID"
herdr pane current --current
herdr pane layout --pane "$HERDR_PANE_ID"
```

Snapshot the Hunk sessions that already exist, then look at this repo's rows and the workspace panes:

```bash
repo_root="$(git rev-parse --show-toplevel)"
before_sessions="$(mktemp)"
node <absolute-find-session-script> snapshot > "$before_sessions"
node <absolute-find-session-script> list --repo "$repo_root"
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
```

Keep `$before_sessions` until the new session is identified in step 3.

- Reuse only a session this run created earlier (for example after a mode change). Any other live Hunk session for this repo, whoever started it, stays untouched: it was not launched with the walkthrough-order extension, and extensions register only at process start. Create the requested surface beside it.
- In `tab` mode, otherwise create a new tab in the caller’s workspace, preserving cwd and keeping focus unchanged:

```bash
herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label "Hunk: $(basename "$PWD")" --no-focus
```

Parse the Hunk tab ID from `.result.tab.tab_id` and the Hunk pane ID from `.result.root_pane.pane_id`; never guess either.

- In `split` mode, otherwise split the caller’s wide pane to the right at exactly half width, preserving cwd and focus:

```bash
herdr pane split --pane "$HERDR_PANE_ID" --direction right --ratio 0.5 --cwd "$PWD" --no-focus
```

Parse the new pane ID from `.result.pane.pane_id`; never guess it.

Done when the requested surface exists: `tab` mode has a labeled Hunk tab with a root pane, or `split` mode has a `ratio: 0.5` split. No unrelated pane or tab was replaced or closed.

If the user changes mode after the surface exists, keep the Hunk process: move a running split pane into a tab with `herdr pane move <hunk-pane-id> --new-tab --workspace "$HERDR_WORKSPACE_ID" --label "Hunk: $(basename "$PWD")" --focus` and parse the new IDs. If Hunk has not started yet, create the requested surface first, then close the empty one only after `herdr pane process-info --pane <created-pane-id>` shows a bare shell. Close only IDs this run created.

## 3. Load the complete diff

Never start the interactive TUI in the agent's own terminal. In Herdr it starts in the user-visible pane through `herdr pane run`; on a plain host the user starts it.

**Plain host:** print exactly this one command for the user to run in their terminal, with the real range and absolute extension path filled in, and wait:

```bash
hunk diff '<review_range>' --mode auto --extension '<absolute-walkthrough-extension>'
```

Then identify the session without a pane: the helper polls until exactly one session for this repo is new since the snapshot. It keeps polling for up to a minute by default; pass `--retries` for longer.

```bash
hunk_session_id="$(node <absolute-find-session-script> identify \
  --repo "$repo_root" --before "$before_sessions" --retries 120)"
```

A non-zero exit means nothing launched yet or two sessions appeared; ask once, then retry. Continue at "From this point forward".

**Herdr:** for a new pane, start Hunk through Herdr with the immutable range:

```bash
herdr pane run <hunk-pane-id> "hunk diff '$review_range' --mode auto --extension '<absolute-walkthrough-extension>'"
```

Identify the session this launch created. The helper polls until exactly one session is both absent from the snapshot and running as a foreground process of the created pane; anything else exits non-zero:

```bash
hunk_session_id="$(node <absolute-find-session-script> identify \
  --repo "$repo_root" --pane <hunk-pane-id> --before "$before_sessions")"
```

A non-zero exit means no session or more than one; do not guess from timing or repo alone. Inspect the pane and retry the launch.

For a session this run created earlier, use its recorded ID directly before reloading it:

```bash
hunk_session_id='<selected-session-id>'
hunk session reload "$hunk_session_id" -- diff "$review_range"
```

From this point forward, use the captured session ID for **every** Hunk command. Never fall back to `--repo`: more than one live session may share a repo root.

Verify the exact session and review structure:

```bash
hunk session get "$hunk_session_id" --json
hunk session review "$hunk_session_id" --json
```

The Hunk file set must equal `git diff --name-only "$review_range"`. Reload the same session ID if it does not. Record Hunk's current file order; unannotated files retain this relative order later. `$before_sessions` is no longer needed once the ID is pinned.

## 4. Build and order the walkthrough

Read the review structure first. Inspect raw patches or local files only for the architectural waypoints you need.

Create **6–10 draft comments** that trace one end-to-end path through the change. Prefer this order:

1. entry/admission
2. orchestration or state transition
3. core behavior
4. trust or authorization boundary
5. side effects and idempotency
6. tests that prove the contract

Make the narrative realizable as one top-to-bottom Hunk stream:

- Each annotated file occupies one contiguous waypoint block; do not leave a file and return to it later.
- Within one file, targets advance by rendered source position. Use at most one waypoint per hunk; consolidate comments when the conceptual order would otherwise move backward or share an anchor.
- Order annotated file blocks by the implementation story. Append every unannotated file in its original Hunk order.
- Only after this normalization, number summaries `N/total — <one-sentence waypoint>` in stream order.

Each rationale explains what happens, why this seam owns it, and the invariant or risk to notice. Keep comments instructional rather than evaluative. Do not annotate every hunk. Target changed lines when possible; use `hunkNumber` when the key symbol is unchanged context inside a changed hunk.

Before applying comments, write the complete deduplicated file order — annotated blocks first, then unannotated files — through the bundled helper:

```bash
printf '%s\n' '{"files":["first/story/file.ts","second/story/file.ts","remaining/file.ts"]}' \
  | node <absolute-write-order-script> --repo "$PWD"
```

The helper stores a 24-hour sidecar under private Git metadata, so it does not dirty the worktree. Reload the pinned range to run the transform, then verify exact order:

```bash
hunk session reload "$hunk_session_id" -- diff "$review_range"
hunk session review "$hunk_session_id" --json
```

The returned file paths must exactly equal the order sidecar. A mismatch means the session did not load the bundled extension; do not apply comments to a misordered stream. Preserve that session, take a new snapshot, start a fresh Hunk process with `--extension <absolute-walkthrough-extension>`, and replace `hunk_session_id` with the helper's `identify` result before continuing.

Once order is verified, use `hunk session comment apply "$hunk_session_id" --stdin` once with the validated JSON batch. List comments from that same session ID afterwards and confirm their numbered summaries appear in ascending order under Hunk's next-comment navigation.

If a numbered walkthrough already exists for the loaded range, inspect and reuse it instead of duplicating notes. Still verify that its numbering, file order, and within-file target order agree; reorder the stream when needed without duplicating comments.

Done when every major behavior belongs to one waypoint, Hunk's file stream matches the narrative order, and next-comment navigation advances `1/total` through `total/total` without jumping backward.

## 5. Hand control to the user

Navigate to waypoint 1:

```bash
hunk session navigate "$hunk_session_id" --file <first-file> --hunk <n>
```

Then focus the requested surface. **Plain host:** nothing to focus; Hunk is already in front of the user. Skip to the verification commands. **Herdr**, in `tab` mode, focus the Hunk tab:

```bash
herdr tab focus <hunk-tab-id>
```

In `split` mode, focus the Hunk pane from the caller; use the actual neighbor direction if the Hunk pane was reused elsewhere:

```bash
herdr pane focus --direction right --pane "$HERDR_PANE_ID"
```

Verify Hunk and the requested Herdr surface:

```bash
hunk session context "$hunk_session_id" --json
hunk session comment list "$hunk_session_id"
```

Herdr only, for `tab` mode:

```bash
herdr tab get <hunk-tab-id>
```

For `split` mode:

```bash
herdr pane layout --pane "$HERDR_PANE_ID"
```

Report only:

- loaded range and file count
- surface: Herdr tab or split with the focused pane/tab, or the user-launched Hunk on a plain host
- walkthrough comment count
- instruction to use Hunk’s next-comment navigation

The walkthrough is complete when Hunk shows the full pinned changeset, waypoint 1 is selected, agent notes are visible, and, in Herdr, the requested surface has focus.
