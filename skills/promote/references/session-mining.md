# Session mining

Read this when a session transcript is a correction source. The questions under "What counts" are adapted from pstack's `reflect` (MIT, see [LICENSE](../LICENSE)).

## Find the transcript

Use `--session <path>` when given. Otherwise find the current session on this host:

| Host | Transcripts | Current session |
| --- | --- | --- |
| Pi | `~/.pi/agent/sessions/<cwd folder>/*.jsonl` | `$PI_SESSION_FILE` |
| Claude Code | `~/.claude/projects/<cwd folder>/*.jsonl` | `<cwd folder>/$CLAUDE_CODE_SESSION_ID.jsonl` |
| Codex | `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl` | the newest file whose first line has this `payload.cwd` |

Pi names the cwd folder by replacing each `/` in the path with `-` and wrapping the result in `--`. Claude Code replaces each `/` and `.` with `-`. When the variable is unset, take the newest transcript for the cwd. Read sessions from the target repo's checkout and its worktrees. Read another project's sessions only when the user names them. A missing transcript goes on the list of missing sources.

Note the file's last line number before reading and stop there, so a live session cannot shift under you.

## Read it

Parse each line with a JSON parser, such as Python's `json`, and skip a half-written last line.

| Host | Messages |
| --- | --- |
| Pi | `type: "message"`, with `message.role` and `message.content` |
| Claude Code | `type: "user"` or `"assistant"`, with `message.content`. A user entry that holds only `tool_result` blocks is tool output. |
| Codex | `type: "response_item"` with `payload.type: "message"`, `payload.role` and `payload.content` |

Corrections are in the user's own words. Tool calls and their results show what actually happened. Injected instructions, skill text and quoted documents are context, not corrections. A compaction summary points at earlier entries, so count the original entries instead.

Cite each candidate by absolute path and line number, with a short quote of the mistake and of the correction.

## What counts

Look for these, and pair each with its evidence:

- The user changed an agent decision that rested on a wrong assumption about requirements, scope, ownership or workflow. Name the decision the next agent should make.
- A result corrected a tool fact the agent got wrong: a command, flag, path, API convention or verification step. Keep the fact that reproduces, not versions or SHAs.
- The user supplied context the agent could have fetched with a tool or skill it had.
- A fix left sibling callers broken, a test passed on a lucky path, or a claimed check has no artifact.
- A skill should have triggered and did not, or triggered late. Cite the moment.

Skip opening requirements, ordinary discovery, retries, and preferences that corrected nothing. Mark a candidate as unverified when its evidence is thin.

Return each candidate as the mistake and its correction, the rule, the affected paths, citations with quotes, the occurrence count or severity, and the proposed rung.

## Large transcripts

Read the transcript yourself in one pass by default. When it is too large for one pass, hand it to a helper agent with the `research` role: on Pi or SumoCode spawn role `research`; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. Give it the absolute path, the line boundary, the target repo, and this file's "Read it" and "What counts" sections. With no helper available, read it yourself in chunks and say so. Check every cited line yourself before using a candidate.

Complete when every user correction and every agent reversal up to the boundary is a candidate or has a reason for its exclusion.
