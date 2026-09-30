# Category searches

Read before discovery/search. Use discovered MCP schemas or CLI help, not hardcoded vendor tool names. Query only sources associated with the target repo/team. Start with symbols, feature names, exact error strings, PR URLs, ticket IDs, authors, and introduction dates; broaden vocabulary when the first search is empty.

## Source control

Use blame, rename-aware file history, pickaxe (`git log -S/-G`), full commit messages/diffs, co-changed files, comments, and tests. Trace introduction and later policy changes. Note shallow history or missing remotes; local git does not guarantee PR access.

For substantive PRs, use `gh pr view <n> --json title,body,author,createdAt,mergedAt,closingIssuesReferences,comments,reviews,files`. Fetch inline review comments/threads separately through `gh api` (paginate) or a discovered MCP tool: `comments` and `reviews` do not include every inline discussion. If commit messages lack PR numbers, use the GitHub commit-to-PR association endpoint `repos/<owner>/<repo>/commits/<sha>/pulls` or a bounded PR search. Read linked issues under the issue category. Quote rationale, not merely the patch.

## Issue tracker

Prefer linked issues, then keyword searches across open and closed items. With GitHub, use `gh issue view` including comments and `gh issue list --state all --search '<query>'`; record result limits. With Linear, inspect `linear --help` and its subcommands before use, verify the associated workspace, and fetch description/comments through supported commands or discovered MCP tools. Follow parents, duplicate chains, project docs, labels, and scope changes. Generic template text and labels alone are weak rationale.

## Long-form docs

Search local `docs/adr`, RFCs, plans, runbooks, and release notes even without remote docs access. Then search available document services by feature, symbol, author, and date. Read complete candidates and linked alternatives/action items; capture section/line or stable URL, author/date, and draft/accepted/superseded status. Check doc/code drift and distinguish an intended plan from the shipped policy.

## Team chat

Search feature/error strings, PR URLs, and author/date windows in engineering/project channels. Fetch whole threads with permalinks and attribution. For defensive code, include incident channels near its introduction. Record authentication failures, retention cliffs, inaccessible DMs, and unsearched channels. Casual suggestions are not necessarily decisions.

## Observability

Identify service/team first. Search dashboards, monitors, incidents, and postmortems before bounded metrics/logs/traces around the change date. Capture IDs, owner/date, exact query/threshold, time window, and compact results. Read incident action items. A matching alert or before/after spike supports a hypothesis, not proof that this line was caused by it. Account for neighboring releases and missing retention.

## Error tracking

Confirm project/org, then search exceptions, symbols, file paths, and exact error strings. Inspect representative events/stacks and issue comments; capture first/last seen, frequency/sampling, affected releases, and stable IDs. Compare with ship dates. Manual resolution, changed grouping, upstream fixes, or sampled counts can mimic a fix. AI-generated root-cause summaries are hypotheses, not primary evidence.

## Analytics

Discover schema/table/column names before querying. Use read-only, time-bounded aggregates around the change: counts, percentiles, exposure/outcome distributions, first/last seen. Prefer typed/deduplicated models and record fully qualified tables and exact queries. Check refresh lag, instrumentation/schema changes, duplicate events, sampling, and retention. Correlate rollout/threshold evidence with author rationale; warehouse rows alone rarely establish intent. Record unavailable notebooks as gaps.

## Follow-up and coverage

Each category returns quotes/citations, queries/items fully read, contradictions, nulls/access limits, and cross-category leads. Assign linked leads to their owning category for follow-up; avoid duplicate searches. For defensive code, pursue incident/postmortem references within every available category, without assuming an incident occurred.

Report all seven categories separately as searched (with scope/results), unavailable (with failure reason), or intentionally skipped (user-scoped or demonstrably irrelevant). Never turn a failed query into "no evidence".
