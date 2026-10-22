---
name: recap
description: Write a brief of the current work session for the person who resumes it tomorrow — goal, what shipped, decisions and why, what is in flight, next action — and save it so the next session can read it. Use when the user invokes /recap or asks what we did last time.
---

# Recap

A recap is the note you would want from a colleague who left for the day: enough to pick the work up cold, short enough to read in two minutes. Not a one-liner, not a transcript.

Invoke as `/recap` to write one now, or `/recap last` to read the most recent saved recap and say what has moved since.

## Where recaps live

`~/.agent/recaps/<repo-name>/<YYYY-MM-DD>-<HHMM>.md`, one file per recap. `<repo-name>` is the basename of the git root, or `no-repo` outside one. Create the directory when missing. If the repo keeps its own session notes (`docs/sessions/`, `notes/`, a `RECAP.md` named in `AGENTS.md`), write there instead and say so.

## Write mode

1. Gather from this session's context first; it is the primary source. Then confirm against the environment so the recap does not contradict reality:
   - `git log --since=<session start> --oneline` and `git status -sb` for what actually landed and what is still dirty
   - `gh pr list --author @me --state all --limit 10` for PRs opened or merged today, when `gh` works
   - any run record, checklist, or plan file the session touched
2. Write the brief in this shape, each section one to four lines, whole thing under 300 words:

```md
# Recap — <repo> — <date>

**Goal.** What we set out to do, in one sentence, and whether it was reached.

**Shipped.** What landed, with the handle to find it: PR number, commit SHA, file path, URL. One line each.

**Decided.** Choices made and the reason, one line each. This is the section future-you needs most; a decision without its why gets relitigated.

**In flight.** Work started and not finished: branch, uncommitted files, a PR waiting on review, a test still red. State it as it is, not as intended.

**Open.** Questions raised and not answered, and anything deferred on purpose.

**Next.** The single first action for the next session, concrete enough to run without thinking: a command, a file to open, a PR to merge.
```

3. Omit a section only when it is genuinely empty; write `none` rather than dropping it, so the reader knows it was considered.
4. Save the file, then print the brief in chat. Both, every time.

**Complete when:** the file exists, every section is present, every "Shipped" line carries a handle, and "Next" is one action.

## Read mode (`/recap last`)

1. Find the newest recap for this repo. None: say so and offer write mode.
2. Print it verbatim.
3. Then append **Since then**, from `git log <recap timestamp>..HEAD --oneline`, `git status -sb`, and the state of any PR the recap named: what moved, what did not, and whether "Next" still applies. Under 100 words.

**Complete when:** the reader knows what was true at the last recap and what changed after it.

## Rules

- Handles over descriptions. `#14`, `a1b2c3d`, `skills/eli25/SKILL.md` beat "the eli25 change".
- The session is the source; git is the check. When they disagree, git wins and the recap says why.
- No praise, no narrative of the process, no list of every file read. What happened, why, what is next.
