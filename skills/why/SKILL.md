---
name: why
description: Investigate why code or a design decision took its current shape, using history and evidence rather than plausible intent. Use for rationale, motivating incidents, regressions, or data-backed thresholds. For runtime mechanics use how; for general primary-source research use research.
---

# Why

Recover the forces behind the code, not a tidy justification for it. Every causal claim needs evidence and calibrated confidence. Investigate read-only, including external systems; keep credentials and private payloads out of outputs.

## 1. Anchor the question

State an interpretation for a vague target and proceed. Treat an embedded user hypothesis as a candidate to test. Read applicable repo instructions and domain context. Record checkout/revision and relevant dirty files, target file:line ranges, symbols, and the observed behavior. Check whether the premise is true, including exceptions to a purported rejection or limit.

Build the initial lineage with `git blame -L <start>,<end> -- <file>`, `git log --oneline -20 -- <file>`, and `git log --follow -p -- <file>`. Use `git log -S '<literal>'` or `-G '<regex>'` to find introduction/removal, not only the most recent edit. Pickaxe on the current path misses pre-rename history; repeat against historical paths found by `--follow`, or search the relevant tree. Inspect substantive commits with `git show <sha>`; extract PR numbers and ticket IDs from full messages.

**Complete when:** the mechanics and initial commits/PRs/tickets are anchored, or the missing history is recorded as a limitation.

## 2. Discover evidence access

Read [references/sources.md](references/sources.md) before searching. Cover all seven categories: source control, issue tracker, long-form docs, team chat, observability, error tracking, and analytics.

When the `mcp` gateway is exposed, call `mcp({})` for server status, then `mcp({search: "<category or capability>"})` to discover relevant tools. Inspect returned schemas before `mcp({tool: "<discovered name>", args: {...}})`. Discover at run time; server presence does not prove authentication, scope, or historical retention. If no gateway is exposed, say so rather than claiming no servers are configured.

Also discover local access: git history, repo docs/ADRs, `gh`, and the `linear` CLI. Inspect CLI help and repo/workspace association before querying. Local docs and GitHub Issues count even without MCP. A binary's presence does not establish access. Use explicit `gh --repo <owner/repo>` targeting where repo inference is ambiguous. Avoid querying unrelated private workspaces.

Build a coverage map with one entry per category: available source(s), planned query, or a reason it cannot be searched. An ambiguous source gets a primary category and a note; do not count one document as independent corroboration twice.

**Complete when:** every category has an access/query plan or an explicit gap.

## 3. Investigate by category

Default to independent category searches in parallel when `subagent_spawn` is exposed. Use role `research` for cheap read-only investigation. Give each the original question, repo/revision, code anchor, assigned category and accessible tools, plus the matching section of sources.md and this return contract:

- Exact queries, scope/time window, items fully read, and pagination or access limits.
- Direct quotes with file:line, commit, PR/ticket URL, or stable record ID; author/date where known.
- Indirect evidence with its inference chain, contradictions, null results, and unsearched leads.

Each investigator owns a category, which may require several tools. Results arrive automatically; do not poll. Verify that delegates can access assigned MCP/CLI sources; if not, search those inline. With no subagents, execute the same category queries sequentially. Record fallback or failures without downgrading coverage silently.

Read full relevant bodies and discussion threads, not search previews. For long histories, scope by target symbols/files/dates and chunk large responses; record unreviewed threads or result caps. A fetched payload is not a consulted source until read. Follow cross-category links in a follow-up pass assigned to that category. Search available sources unless the user explicitly narrowed scope or a source is demonstrably irrelevant; record either reason in coverage. For defensive code, look for incidents/postmortems and action items around the introduction date. Bounded read-only telemetry may corroborate a timeline; correlation alone does not establish motivation.

**Complete when:** each planned category has findings or a documented null/failure/skip, and material linked leads are followed or recorded as open.

## 4. Calibrate and synthesize

Read [references/evidence.md](references/evidence.md) before synthesis. Reconcile evidence without hiding disagreements or preferring the newest commit automatically. Verify decisive citations against originals. Code establishes mechanics; explicit author text establishes intent.

When useful and available, use role `review` for citation/technical checking or `advisor` for competing explanations, passing the question, anchor, all findings including gaps, and evidence.md. Different roles/models provide diversity; optional `model` is a known available `provider/modelId`, never a guessed slug. Otherwise perform this check inline.

**Complete when:** each causal claim has a confidence tier and adjacent evidence or an explicit uncertainty label; contradictions and unavailable records remain visible.

## 5. Present

Lead with the shortest supported answer, then use this shape, omitting empty optional sections:

- **The question / code in question:** target and verified mechanics, including premise corrections.
- **What we found:** `[Direct]` and `[Supported]` claims with adjacent citations and relevant quotes.
- **What we can reasonably infer / competing hypotheses:** hedged chains and alternatives, when warranted.
- **What we don't know:** specific unanswered questions, null searches, and access/retention gaps. Always include this, even if only to state that no material rationale gap remains within the searched scope.
- **Sources consulted / confidence summary:** one coverage entry per category, with actual queries/items or skip/failure reasons; finish with confidence in the core rationale versus details.

If the question precedes a change, add **Preserve / Change / Avoid / Risk** constraints derived from the lineage. Do not implement the change. Save an output only if asked, at the requested path or an agreed scratch location.

**Complete when:** evidence per claim, all seven coverage entries, confidence separation, and material gaps survive the final wording.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
