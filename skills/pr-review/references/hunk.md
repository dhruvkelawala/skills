# Stops as Hunk notes in Herdr

Use this only inside Herdr (`HERDR_ENV=1`). It opens the pinned range in Hunk and attaches the stops from step 3 as numbered notes, so Hunk's next-note key walks the story in order.

Resolve these bundled files relative to the skill's `SKILL.md`, and keep their absolute paths for the run:

- `extensions/walkthrough-order.ts`, a Hunk transform that applies an exact, unexpired file order.
- `scripts/write-order.mjs`, which validates that order and writes it under the checkout's private Git metadata.
- `scripts/find-session.mjs`, which snapshots Hunk sessions and finds the one this run launched.

Always load the bundled extension, never one from the repository under review. Hunk extensions run with the user's permissions.

## 1. Make the tab or split

Read the installed CLI instead of assuming its syntax: `herdr tab`, `herdr pane`, `herdr pane current --current`, and `herdr pane layout --pane "$HERDR_PANE_ID"`.

Snapshot the Hunk sessions that already exist:

```bash
repo_root="$(git rev-parse --show-toplevel)"
before_sessions="$(mktemp)"
node <find-session> snapshot > "$before_sessions"
```

Reuse only a Hunk session this run created earlier. Leave every other session alone. Sessions started by someone else were not launched with the order extension, and extensions only load at process start.

- **Tab (default).** Run `herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label "Review: #<n>" --no-focus`. Read the tab ID from `.result.tab.tab_id` and the pane ID from `.result.root_pane.pane_id`.
- **Split.** Run `herdr pane split --pane "$HERDR_PANE_ID" --direction right --ratio 0.5 --cwd "$PWD" --no-focus`. Read the pane ID from `.result.pane.pane_id`.

Read every ID from the command's output; never guess one. Close only panes and tabs this run created.

## 2. Load the pinned range

Start Hunk through Herdr, never in the agent's own terminal:

```bash
herdr pane run <pane-id> "hunk diff 'refs/pr-review/<n>-base...refs/pr-review/<n>-head' --mode auto --extension '<walkthrough-order.ts>'"
hunk_session_id="$(node <find-session> identify --repo "$repo_root" --pane <pane-id> --before "$before_sessions")"
```

A non-zero exit from `identify` means it found no session or more than one. Inspect the pane and launch again; do not guess from timing. From here on, pass `"$hunk_session_id"` to every Hunk command. Never select a session by `--repo`, because several sessions can share one repo.

For a session this run created earlier, reload it with `hunk session reload "$hunk_session_id" -- diff '<range>'`.

**Done when** `hunk session review "$hunk_session_id" --json` lists exactly the files from `git diff --name-only '<range>'`.

## 3. Order the files and attach the stops

1. **Arrange the stops as one top-to-bottom stream.**
   - Each file with stops is one block; the walk never leaves a file and comes back.
   - Within a file, stops follow line order, with at most one stop per hunk. Merge two stops when the story would otherwise jump backward.
   - Order the file blocks by the story of step 3. Then append every file without stops, in Hunk's original order.
2. **Number the stops** `N/total: <one-line summary>` in stream order.
3. **Write the full file order:**

   ```bash
   printf '%s\n' '{"files":["first/story/file.ts","second/file.ts","remaining/file.ts"]}' \
     | node <write-order> --repo "$PWD"
   hunk session reload "$hunk_session_id" -- diff '<range>'
   ```

   The order file lives under private Git metadata for 24 hours and never dirties the worktree.
4. **Check the order.** `hunk session review "$hunk_session_id" --json` must list the files in exactly that order. A mismatch means the session did not load the bundled extension. In that case, start a fresh Hunk process with `--extension`, identify the new session, and use its ID.
5. **Attach the stops.** Apply all of them once with `hunk session comment apply "$hunk_session_id" --stdin`. Target a changed line where you can; use `hunkNumber` when the key symbol is unchanged context inside a changed hunk.

If numbered notes already exist for this range, reuse them instead of adding duplicates.

**Done when** `hunk session comment list "$hunk_session_id"` shows the stops numbered 1 to total in stream order.

## 4. Hand over

1. Go to the first stop: `hunk session navigate "$hunk_session_id" --file <first-file> --hunk <n>`.
2. Focus what you created: `herdr tab focus <tab-id>` for a tab, or `herdr pane focus --direction right --pane "$HERDR_PANE_ID"` for a split.
3. Verify with `hunk session context "$hunk_session_id" --json`.

Tell the user to use Hunk's next-note key.

## Reading the user's notes back

The user often leaves notes in Hunk. To read them, run:

```bash
hunk session comment list "$hunk_session_id" --type all
```

Without `--type all`, you see only your own notes. Add their notes to the PR's ledger (step 5 of the skill).

If the user asks to switch from a split to a tab, move the running pane rather than restarting Hunk:

```bash
herdr pane move <pane-id> --new-tab --workspace "$HERDR_WORKSPACE_ID" --label "Review: #<n>" --focus
```
