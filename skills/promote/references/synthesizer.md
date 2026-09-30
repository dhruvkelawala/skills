# Session synthesis

Apply the shared review contract supplied by the parent. Read the selected transcript through its pinned boundary and all supplied reviewer outputs (or the sequential pass). Verify citations against the original entries and referenced code/requirements; reviewer outputs are claims, not authority. Report inaccessible evidence rather than inventing it.

1. Merge by root cause and invariant, preserving every independent incident's citations and any conflicting evidence. Reviewer convergence increases confidence, not occurrence count; a singleton may be valid and a unanimous claim may be wrong.
2. Test durability, specificity, decision-changing value, and promote's recurrence/severity threshold. An opening task requirement is not a correction. Reject platitudes, drifting details, speculative routings, duplicates, and mistaken findings with a reason. Defer valid one-offs that do not qualify.
3. Read the owning skill before proposing a skill edit. Accept an evidenced body gap or missed description trigger at its existing home; reframe buried guidance as a placement/wording fix. Reject duplication of clear guidance. Prefer existing workflows over new skills.
4. Apply promote's enforcement ladder before accepting prose. Mechanically enforceable lessons belong in Backlog at the highest viable rung, with the mechanism and reasons higher rungs fail, even if implementation is costly. If code or requirements cannot yet be checked, keep the candidate unverified in Backlog rather than accepting it.

Return exactly these three headings with numbered entries or `None` (no edits or issue filing):

## Accepted

Qualified, verified lessons requiring judgment-based instruction/skill changes. For each: problem → proposed change, invariant, paired file/line or source citations and short quotes, distinct occurrences or severity, owning path/section, chosen rung, and why higher rungs cannot enforce it. These are proposals only; the parent waits for explicit approval before editing.

## Rejected

For each: candidate/invariant, citations, and reason (e.g. not-a-correction, already-covered, duplicate, wrong-finding, unsupported-routing, or not-durable). Preserve evidence for disagreements; a wrong finding may expose a different review-policy correction but cannot justify enforcing the wrong advice.

## Backlog

For each: pattern/invariant, citations, qualification (qualified, deferred one-off, or unverified), impact, suggested structural mechanism/rung or exact missing evidence, and next action. Backlog is a report category, not permission to file issues automatically; the parent uses promote's artifact rules, and report-only runs stop at this list.

**Complete when:** every candidate has a disposition, provenance, and reason; Accepted entries passed the structural check and Backlog entries state qualification/blockers explicitly.
