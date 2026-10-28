---
name: modernize
description: Use for /modernize, or when the user asks to rebase, update or revive an old PR, or whether a stale PR should still land. Judges the PR against what its base has become, says MODERNIZE, REWORK or CLOSE with the evidence, and rebases and pushes only a MODERNIZE.
---

# Modernize

Modernize the idea, not just the branch. A clean rebase doesn't prove the PR still belongs in the product.

Invoke as `/modernize <PR number | URL>`. The `day` morning report offers it for the user's PRs that are going stale.

For GitHub calls, use GraphQL or REST within the shared [API limits](../pr-watch/references/github-api.md). `gh api` fills `{owner}` and `{repo}` from the current checkout.

## Rules

- **Verdict before push.** The rebase in step 4 runs only for MODERNIZE. Modernizing never merges, closes, retargets or widens the PR.
- **Whose branch.** Push to the PR's branch when the user wrote the PR or this thread owns it. On anyone else's PR, stop before the push with the rebased branch local, and ask.
- **Lease.** Push a rebased branch only with a lease on the head step 1 recorded. When the lease fails, someone pushed in the meantime: fetch, and start again at step 1.
- **The user's changes.** Uncommitted changes in the checkout belong to the user. When it has any, do the work in a new worktree (`git worktree add`).
- **Quiet.** Post nothing on the PR unless the user asks.

## 1. Pin the PR's intent

Read the PR: `gh pr view <n> --json url,state,author,baseRefName,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository,title,body,closingIssuesReferences,commits,reviews,statusCheckRollup` (REST: `gh api repos/{owner}/{repo}/pulls/<n>`, plus its `/commits` and `/reviews`), its review threads with `gh pr view <n> --comments` (REST: `gh api repos/{owner}/{repo}/pulls/<n>/comments`), the issues it closes, and the whole diff with `gh pr diff <n>`. Then write, in one sentence, the smallest goal the PR was after, before you judge how it gets there.

Fetch the base and the PR's head: `git fetch origin <base> pull/<n>/head`. Record the head SHA and the merge base, `git merge-base origin/<base> <head>`, so the PR's own change and what the base did since stay apart.

**Done when:** you hold the goal sentence, the head SHA, the base branch and the merge base.

## 2. Read what changed around it

Read the base since the merge base: `git log --oneline <merge base>..origin/<base>`, and `git diff --stat <merge base> origin/<base> -- <the PR's files>`. Search merged and open PRs on the same paths or behaviour: `gh pr list --state all --limit 50 --search "<words from the goal>"` (REST: `gh api "search/issues?q=repo:{owner}/{repo}+is:pr+<words>&per_page=50"`).

Answer each question with its evidence, a commit, a PR or a `path:line`:

- Has the base already solved the same problem for the user?
- Did an API, type, schema, dependency or boundary the PR relies on change?
- Do the PR and the base now both own the same behaviour?
- Was the code the PR changes deleted, moved or simplified on purpose?
- Would landing it bring back old behaviour, or add a second way to do one thing?
- Is what it gives still worth the code it adds?

A PR isn't current just because Git reports no conflicts.

**Done when:** every question has an answer with its evidence, or "nothing found" with where you looked.

## 3. Decide

- **MODERNIZE.** The goal still matters and the code is still the right shape. Go on to step 4.
- **REWORK.** The goal still matters, but a rebase would keep the wrong code. Name the smallest rewrite that would work, and stop before any push, unless the user also asked for the rework.
- **CLOSE.** The PR is superseded, obsolete, pointed the wrong way, or no longer worth its cost. Name the evidence and stop. Close it only on the user's word, with a comment that gives the evidence and opens with pr-watch's [label](../pr-watch/SKILL.md#the-label), checked as that section says.

Age is not evidence, and the work already in the PR is no reason to keep it. Say CLOSE when the evidence says so.

**Done when:** one of the three is chosen, with the evidence from step 2 that decided it.

## 4. Rebase

For MODERNIZE only.

1. Check out the recorded head on a local branch, and rebase it onto `origin/<base>`. Resolve each conflict so the PR keeps its goal and follows the base's newer rules, with the `resolving-merge-conflicts` skill. A conflict that shows a disagreement about the product or the design is evidence for step 3: go back and decide again.
2. Compare the commit series before and after with `git range-diff <merge base>..<head> origin/<base>..HEAD`, and read the final `git diff origin/<base>...HEAD`. Every change the PR meant to make is still there, and nothing the base already landed comes back.
3. Run `/verify` in focused mode on the paths the PR touches. For each failure, run the same check at `origin/<base>`, and tell one the rebase caused from one the base already has or an infrastructure fault.
4. Push under the rules: `git push --force-with-lease=<head branch>:<recorded head> <remote> HEAD:<head branch>`. The remote is `origin`, or for a PR from a fork, the fork (`headRepositoryOwner/headRepository`, REST: `.head.repo.full_name`), added with `git remote add` when the checkout has none.

**Done when:** the range-diff shows nothing lost or brought back, the focused checks pass or each failure has its cause, and the PR's head on GitHub is the rebased commit, or the push waits on the user's word under the rules.

## Report

Lead with MODERNIZE, REWORK or CLOSE and the reason in one sentence. Then:

- What changed on the base that matters to this PR
- Conflicts of meaning, or "none found" with where you looked
- The rebase and push: the new head, or why nothing was pushed
- The checks run, with their results
- What is left for the user: the rework, the close, or `/pr-watch <n>` to watch the new head's checks
- The PR's link

Keep what you saw apart from what you judge, and name what you couldn't check.

## Credits

Adapted from Theo Browne's `modernize` in [tstack](https://github.com/t3dotgg/tstack) (MIT), at `t3dotgg/tstack@7de017b`. Upstream license: [LICENSE](LICENSE).
