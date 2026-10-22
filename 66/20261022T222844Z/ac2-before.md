# AC2 before: /issue-to-pr <plan file> (base cb14ee7)

Skill text: issue-to-pr and ticket at cb14ee7, run in headless Claude Code in a scratch repo (acme/demo) with a fake gh that records every call.

## The command

```text
/issue-to-pr plans/001-json-export.md
```

## Skills the run loaded

- none

## gh calls, in order

```text
gh repo view --json name,defaultBranchRef
```

## Issues filed

None.

## Where the run ended

- turn ended (exit 0)
- read the filed issue with gh: no
- build branch for a filed issue: none

## The agent's last message

> I stopped at stage 1, step 3. That step needs T3 to move this run into its own worktree, and T3 tools aren't available here. Nothing has been built, committed or pushed. I made no changes to the main checkout and didn't create a run record.
> 
> **What's set so far**
> - **Work item:** the local plan file `plans/001-json-export.md`, not a GitHub issue. It isn't committed; it shows as untracked in `git status`. I used `001` as the issue number for the branch and run record.
> - **Repo and remote:** `acme/demo`, remote `origin`.
> - **Mode:** standalone.
> - **Base:** `refs/remotes/origin/main` at `4eb2d6151caa3a3cbc958482688b990a4fe3a2fc`, which is also the current `HEAD`.
> - **Run record:** none exists yet. It would go at `~/.agent/issue-to-pr/demo/001.md`.
> 
> **The call I would make**
> This thread is on the project's main checkout (branch `main`), so step 3 would end the turn with:
> 
> ```
> t3_worktree_handoff({
>   branch: "feat/001-json-export",
>   baseRef: "main",
>   startFromOrigin: true,
>   continuationPrompt: "/issue-to-pr plans/001-json-export.md"
> })
> ```
> 
> (I'd call `t3_worktree_status` first to confirm this case; it isn't available either.)
> 
> The continuation would start stage 1 again in the new worktree. Because the plan file isn't committed, a worktree started from `origin` won't contain it. The continuation would have to read it from this checkout's absolute path, or you'd need to commit it first.
> 
> **What the plan asks for, for the contract once the run resumes**
> - **In scope:** `src/cli.ts`, `src/export.ts`, `src/export.test.ts`. **Out of scope:** `demo import`.
> - **Done criteria (all on the CLI):**
>   1. `demo export --format json` prints an array of row objects with the same columns as the CSV.
>   2. `demo export` with no option still prints CSV.
>   3. `demo export --format xml` exits with code 2 and prints `unknown format: xml`.
> 
> To continue, run this from a session where T3 is available, or tell me to build on a plain `git` branch in this checkout instead. That second option departs from the skill's worktree rule.
