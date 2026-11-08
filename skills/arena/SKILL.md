---
name: arena
description: Use for /arena, "swarm this", competing attempts at one task, or parallel coverage of separate slices. Runs N isolated workers, then selects and verifies one result or consolidates an evidenced report.
---

# Arena

One workflow covers pstack's arena and swarm. Choose `candidates` for competing solutions or `coverage` for separate slices. Invoke as `/arena [candidates|coverage] [N] <task>`. Default to two candidates; for coverage, derive N from the required slices when the user gives no count.

Keep the phases in the host's plan tool. The parent owns the final result and the existing T3 thread. This workflow does not publish, merge or start unattended work beyond the user's request.

## 1. Frame

Write the done condition, common grounding, exact base/head when relevant, and verification method before launching workers. For measurements, state sample count, what counts as a sample and run order.

- **Candidates:** give every worker the same brief. Keep a rubric of three to six gradeable criteria for the later judge. Declare `best-of` by default, `rank all` for comparison, or `first pass` when the first independently verified result is enough.
- **Coverage:** assign non-overlapping slices and list which are required. A mixed run can race candidates within a slice, but every required slice must still finish.

Use the `parallel-worker` job from [models.json](../models.json) and apply [model-policy](../model-policy/SKILL.md), including explicit user choices and availability fallback. For a model race, name each arm's configured model and settings before launching. Same-model attempts count as separate attempts, not model diversity.

Give each writer its own worktree from the pinned base, or its own artifact directory for prose. Separate worktrees can still share ports, accounts and external state; allocate those through the repo's isolation recipe. Reviewers read frozen outputs. Keep the parent as the sole writer of shared state and any [decision log](../show-me-your-work/SKILL.md).

Complete when each seat has a brief, model route, owned output, required checks and a declared selection rule.

## 2. Fan out

Use the host's supported helper route. In T3, use `delegate_task` children in the same project, with worktree isolation for writers and targets resolved from the configured job and `orchestrator_capabilities`. In another host, use its native helpers with the same isolation and model policy. N is the total seats, so queue work above the host's concurrency limit. If helpers cannot run, report that limit; serial work is not a parallel result.

Every brief stands alone: goal, scope or slice, grounding paths, pinned revisions, output path, commands and expected report. Workers return `PASS`, `ISSUES` or `BLOCKED`, actual model, tested SHA or artifact hash, method, artifact paths, evidence and all confirmed defects. Candidates also explain their rejected alternatives.

Track task IDs. Consume completed results through the host's completion mechanism and keep working on independent parent tasks. Before replacing a worker, cancel its active attempt and retain partial evidence. A dropped seat is reported, never counted as a pass.

For `first pass`, move to step 3 when a candidate reports `PASS`; otherwise collect every seat's terminal result. Complete when all seats are accounted for and the results needed by the declared rule are ready.

## 3. Judge and combine

Read every completed result and open its evidence. A missing required revision or hash, method or artifact earns one corrected brief to a fresh replacement; a second miss is a gap.

For `best-of` or `rank all`, wait until candidate outputs are frozen, then start a fresh read-only judge using the `artifact-review` job and model policy. Give it the rubric and paths by candidate label. Read and score each candidate yourself while it works. Settle disagreements against the criteria and evidence. With no independent judge, mark selection incomplete.

For `first pass`, independently run the declared checks on the candidate before choosing it, then cancel and drain the remaining workers. It is the first verified pass, not a claim that it is best.

For `best-of`, pick one base and port only useful parts of the others by hand. State which candidate supplied each part and why. Consensus needs no graft; incompatible solutions need a clearer brief rather than an average. For `rank all`, return the comparison without synthesizing an artifact.

For coverage, merge duplicate findings, retain contradictory evidence, and report each required slice. One missing slice makes coverage incomplete. Accept a worker's proposed code change only after reading its diff and checking it in the final checkout.

Complete when the selection follows the declared rule, every finding has evidence, and every missing seat or slice is visible.

## 4. Verify and report

Run the project's checks on the final artifact through [verify](../verify/SKILL.md) and drive the claimed behavior through its evidence recipe. A report-only run resolves its citations and reproduces its key claims. Check the combined result even when every worker passed separately.

Return one table of seats, models, artifacts and outcomes, followed by the selected base or merged findings, judge result, accepted and rejected parts, test commands, dropouts and unresolved gaps. Release managers can link this report from their decision log and merge digest. Apply [unslop](../unslop/SKILL.md) to the summary. Keep output artifacts; release only this run's temporary resources after all workers stop.

Complete when the final verification has a result, all children are terminal and no known gap is presented as a pass.

Adapted from pstack's arena and swarm by Lauren Tan (MIT), [cursor/plugins@1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def](https://github.com/cursor/plugins/tree/1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def/pstack). Upstream license: [LICENSE](LICENSE).
