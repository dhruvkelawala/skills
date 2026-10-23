# Resume

`/issue-to-pr <n> resume` continues a run that stopped at `published`, `watching`, `awaiting-human` or `blocked`.

A spec's record with `spec_mode: stack` has no branch of its own. For it, run [start what can start](spec.md#start-what-can-start) once, and skip the rest of this page.

1. Work on the recorded branch, in the worktree that has it checked out (`git worktree list`). When `t3_worktree_status` shows this thread in that worktree, continue here. When another worktree has it, call `t3_thread_launch` with `workspaceStrategy` set to `{"type": "existing_worktree", "worktreePath": "<path>", "branch": "<branch>"}` and `message` set to `/issue-to-pr <n> resume`, give the user its link, and stop. When no worktree has it, record `blocked: branch not selectable` and stop, before any repair. Never switch this thread's checkout to the branch. Then `git status` must be clean and `HEAD` must equal the recorded head or the PR's `headRefOid`.
2. Run the checks in [run record](run-record.md) under "When a record already exists".
3. Pick the case:
   - **Predecessor moved.** The run is stacked, and the predecessor's `headRefOid` differs from `base_sha`, or the predecessor merged.
   - **Review came in.** A review, a review thread, or a PR comment from someone other than the PR author is newer than the recorded head. The gate lists unanswered ones in `threads`.
   - With both, handle the predecessor first, then the review, without a second rebase.
   - With neither, run stage 6 once.

The repair budget in the record still applies.

## Predecessor moved

1. Run `git fetch origin`. The new base is the predecessor's head branch, or the default branch when the predecessor merged. When it closed without merging, record `blocked: predecessor closed` and stop.
2. Move only this layer's commits: `git rebase --onto <new base ref> <base_sha> <branch>`. Use this in a gh-stack-tracked stack too, so the predecessor branches are never rewritten. Resolve any conflicts.
3. Compare `git rev-parse HEAD^{tree}` with the recorded tree. When they are the same, as after the predecessor squash-merged, the earlier tests and reviews still hold. Otherwise run the focused tests for the touched paths.
4. Push only this branch: `git push --force-with-lease origin <branch>`. When the predecessor merged and GitHub did not retarget the PR, run `gh pr edit <n> --base <default-branch>` (REST: `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -f base=<default-branch>`).
5. Record the new `base_ref`, `base_sha`, `head` and `tree`. Run the base and file-count checks from [stacks](stacks.md), and refresh the PR body for the new head with `gh pr edit --body-file` (REST: `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -F body=@<file>`).

Then run stage 6 once.

## Review came in

Do each step once.

1. Read every new review, thread and `kind: "review"` entry in full. Check each finding against the code and rate it as stage 3 does.
2. When the gate reports the branch as behind its base or in conflict, rebase onto the live base.
3. Fix each accepted finding as a repair, one commit each with the focused tests, or decide to reject it with a reason.
4. Run `/verify` at the new head.
5. Push only this branch: `git push origin <branch>`, with `--force-with-lease` after a rebase.
6. Answer the reviewers. Reply on each thread, and resolve it after its fix is pushed or its rejection is posted. For a `kind: "review"` entry, post one PR comment that answers it point by point.
7. Refresh the PR body for the new head with `gh pr edit --body-file` (REST: as in the predecessor case, step 5), listing the repairs as not re-reviewed.
8. Re-request review: `gh pr edit <n> --add-reviewer <login>` (REST: `gh api -X POST repos/{owner}/{repo}/pulls/<n>/requested_reviewers -f "reviewers[]=<login>"`) for a human, or the request comment for a bot.

Then run stage 6 once.

**Complete when:** the PR head equals the pushed head, the body shows that head, every new finding has a fix or a reply, the record shows the new head, tree, repairs and stage, and stage 6 has run once.
