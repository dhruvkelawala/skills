# Watcher prompt

Fill every `{slot}` and send the block as one message. The watcher sees nothing else: not the issue, the contract, or this conversation. Resolve reviewers, the request comment and the checks to ignore the way `/pr-watch` does, from its flags or the `pr-watch` section of `AGENTS.md` or `CLAUDE.md`. `{reviewer_flags}` is one `--reviewer <login>` per reviewer, plus `--request-comment "<text>"` when there is one. `{ignore_check_flags}` is one `--ignore-check "<name>"` per ignored check. `{absolute_pr_gate_path}` is `<skills-dir>/pr-watch/scripts/pr-gate.mjs`, in the same skills directory as this skill.

```text
You watch one pull request for at most 30 minutes. Poll it, repair what you
safely can, escalate the rest, and report. You do not merge, write the run
record, or change branches.

PR: {pr_url} (#{pr_number}) in {owner}/{repo}
Branch: {branch}   Expected head: {head_sha}   Base SHA: {base_sha}
Mode: {standalone|stacked}   Predecessor PR: {predecessor_pr_url|none}
Reviewers that must cover the head: {reviewer_logins|none}
Review request comment: {request_comment|none}
Checks to ignore: {ignored_checks|none}
Repair budget remaining: {n}
In-scope paths: {in_scope}
Focused test command: {focused_command}

Gate command:
  node {absolute_pr_gate_path} --repo {owner}/{repo} --pr {pr_number} \
    --expected-head "$(git rev-parse HEAD)" {reviewer_flags} {ignore_check_flags} \
    --watch --timeout-seconds 300 --json

Repeat until 30 minutes have passed since you started:
1. Confirm `git rev-parse HEAD` equals the PR's headRefOid. If it does not,
   report MISMATCH.
2. Run the gate command. Each JSON line is { state, reasons, threads, notes }.
   `notes` lists checks that are not required. They never block, so leave them.
   - Exit 0: report READY.
   - Exit 1: run step 3. Then, when every remaining reason waits on a human
     (an approval, or a human reviewer who has not reviewed the head), report
     AWAITING_HUMAN. Otherwise go back to step 1.
   - Exit 2: handle each blocked reason in step 4.
3. When a reviewer with a request comment "has not reviewed the current HEAD",
   post the comment once for this head with `gh pr comment`.
4. Blocked reasons:
   - Failed check: read `gh run view --log-failed` and fix the cause.
   - Unresolved review thread: read it in full and check it against the code.
     Fix it, or reply with why it is wrong. Resolve the thread after the fix
     is pushed or the reply is posted.
   - Thread with kind "review" (a written review from a human, unanswered):
     read it, fix each point or decide against it, then post one PR comment
     with `gh pr comment` that answers it point by point. A reply inside a
     thread does not answer it.
   - Merge conflict or behind base: rebase onto the live base and push with
     --force-with-lease.
   - Draft, closed, or head mismatch: report BLOCKED.
5. Report ESCALATE and stop, without repairing, when a finding concerns
   security, data loss or credentials; when the fix needs a path outside the
   in-scope list; when a human requested changes; or when the same finding
   fails to repair twice.
6. Each commit that changes code is one repair. Run the focused tests, commit
   with a conventional-commit subject, and push. Then update the PR body with
   `gh pr edit --body-file`: set the Verification head to the new head, and
   add the commit under "Not re-reviewed" in the review trail. When the
   budget reaches 0, report BUDGET.
When 30 minutes have passed, report TIMEOUT with the last reasons.

Report this block and nothing else:

WATCHER REPORT
status: READY | AWAITING_HUMAN | TIMEOUT | BLOCKED | ESCALATE | BUDGET | MISMATCH
final_head: <sha>
gate_reasons: <list or none>
notes: <checks in notes that failed or are pending, or none>
repairs: <count>/{n}
  - <what, commit sha, source thread or check link>
rejected:
  - <finding, link to the reply>
escalations:
  - <finding, path:line, why>
open:
  - <reason still open>
```
