# GitHub API use

Use `gh pr`, `gh issue`, `gh repo`, `gh api graphql` or REST according to the data the task needs. GraphQL is welcome within the bounds below. Commands and REST alternatives in a skill are examples; either API is suitable when it preserves the required fields and safety checks.

Use existing helper scripts as documented. These bounds apply to calls you construct. Reuse a helper's result until its inputs or the relevant remote state change.

## Bound the work

- Scope reads to the repository, PR, issue or search window in the task. Select the fields needed for the next decision with `--json` or a focused GraphQL selection. Reuse a response until the relevant state changes.
- Set `first` or `last` on every GraphQL connection. Start with 50 items or fewer, and use at most 100 per page. Set an explicit `--limit` on CLI lists. Default to at most five pages and 500 items per collection, including nested collections. Request `pageInfo { hasNextPage endCursor }` for forward pagination or its backward equivalent. When a CLI command hides pagination, use a bounded API query if its request count could exceed the budget.
- Default to at most 20 GraphQL requests per invocation, or per event-driven pass in a watch. When the task needs more requests or items, state the reason and a larger finite budget before fetching them. Keep nested queries small; page size alone does not bound a query that expands several connections at once.
- Before a batch or paginated read, check `gh api rate_limit --jq '.resources.graphql | {remaining, reset}'`. Include `rateLimit { cost remaining resetAt }` in custom queries in that batch. Leave 100 points in reserve for other agents on the account; use REST or defer optional reads when the reserve would be crossed. A single small read needs no separate quota probe.

## Handle limits and incomplete data

- On GraphQL quota exhaustion, stop GraphQL calls until the reported reset time. REST has a separate primary quota and can supply equivalent data. A secondary rate limit applies across API choices: respect `Retry-After` or the reported backoff, then retry at most once. Avoid repeated helper calls that only reproduce the same quota error.
- If a page or request budget ends before the required data is complete, report the truncation. Treat GraphQL errors and partial responses as incomplete for the affected fields. Narrow the scope or state a larger finite budget when completeness matters. A bounded sample can guide discovery; a review or merge gate stays pending when required checks, reviews or thread state are unknown. REST cannot supply review-thread resolution or GraphQL's aggregate review decision.
- Before retrying a mutation through either API after an ambiguous failure, read the remote state and confirm it was not applied. Preserve the workflow's head pin, authorization and posting rules whichever API performs the write.
