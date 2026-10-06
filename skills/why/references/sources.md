# Deep sweep sources

Read this before a `/why --deep` sweep. Search only sources tied to this repo or team. Start from the anchor: symbols, file paths, exact error strings, PR and issue numbers, authors, and the date the code arrived. Widen the search words when a search comes back empty.

First find what this session can reach. List the host's MCP servers and tools. On Pi the `mcp({})` gateway lists them; in Claude Code and Codex they appear in the tool list. Check local CLIs such as `gh` and `linear` with `--help`. A configured server or an installed CLI does not prove that you can log in or that old records still exist.

Give each helper the question, the anchor, its one source, and the matching section below. Each helper returns its queries, the items it read in full, direct quotes with links, and any leads that belong to another source.

## Git and PRs

Run `git log -S` and `-G` on the current path and on old paths from `git log --follow`. Read full commit messages, files changed in the same commit, and tests. For each PR that matters, read `gh pr view <n> --json title,body,comments,reviews,closingIssuesReferences` and the inline threads from `gh api repos/<owner>/<repo>/pulls/<n>/comments --paginate`. Quote the reasoning, not the patch.

## Issue tracker

Start with linked issues, then search open and closed ones: `gh issue list --state all --search '<words>'`, or Linear through its CLI or MCP after checking it is the right workspace. Follow parent and duplicate links. Labels and template text are weak evidence.

## Docs

Search the repo's `docs/`, ADRs, RFCs, plans and runbooks, then any doc service the host can reach. Note whether each doc is a draft, accepted, or replaced, and whether the code still matches it.

## Team chat

Search feature names, error strings, and PR links in the weeks around the date the code arrived. Read whole threads and keep permalinks. A suggestion in chat is not a decision.

## Observability and error tracking

Find the service first. Look for incidents, postmortems, monitors, and the first-seen date of a matching error near the change date. A spike that lines up with a change supports a story but does not prove the author's reason. Treat AI summaries inside these tools as guesses.

## Analytics

Find table and column names before querying. Run read-only, time-bounded counts around the change. Data rarely shows intent, so pair it with author text.

## Calibrating the answer

- A PR that says "fixes timeouts" records the goal. It does not show that timeouts stopped.
- When sources disagree, quote both with their dates instead of picking the newest.
- For defensive code such as retries, timeouts, null guards, and rate limits, look for an incident near the date it arrived.
- Record a failed or unavailable search as a gap, separate from a search that found nothing.

## Coverage lines

Write one line per source, in one of three forms: searched, with the queries and time window; unavailable, with the reason; or skipped, with the reason.
