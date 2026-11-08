---
name: blast-radius
description: Use for /blast-radius, "what could this break", or a release manager's safety check after a build and before merge. Looks beyond the diff and proves the key safety assumption by running real code.
---

# Blast radius

Find what a change could break outside its diff. [How](../how/SKILL.md) explains the flow; [why](../why/SKILL.md) explains its history. This check proves the fact the change's safety depends on.

Invoke as `/blast-radius <PR, commit range or change>`. With no target, use the current change. It produces a report and proof artifacts; production repairs stay with the build's owner.

## 1. Pin the change

Record the repository, base SHA, tested head and acceptance criteria. Read the whole diff and the changed entry points at that head. Use the existing T3 build or release thread's checkout when it matches; otherwise make an isolated checkout. Read the repo's agent instructions, verification skill and `EVIDENCE.md` before running anything.

Complete when the report names the exact base and head, what changed for callers, and the paths that own it.

## 2. Find the safety assumption

Choose the one or two facts that clear the largest plausible failures, such as "this deletion only reaches expired cache entries". Follow their consumers beyond direct callers: serialized data, database columns, other languages, startup configuration, feature flags, library versions and patches, teardown and deferred callbacks. Open the source behind each claim.

Keep confirmed or supported risks. For each, name the failure, affected users, likelihood and cost with a reason, and a `path:line`. Record cleared risks separately. Use uncertainty labels rather than invented probabilities. For a wide change, [arena coverage](../arena/SKILL.md) can divide the investigation; every required slice still needs evidence.

Complete when the safety assumption and each material risk have a source pointer or an explicit unknown.

## 3. Run the proof

Use the smallest test, script or app recipe that calls the real code at the tested head. A fake implementation or a prose trace cannot prove the assumption. Exercise the dangerous case as well as the safe one, and check that the assertion fails when its claimed effect is absent. Use the repo's evidence recipe and isolated data; leave shared services and user state under their existing permissions.

Record the exact command, exit status, relevant output, tested head and artifact path. Distinguish source inspection, failure-path tracing, an executed proof, and reproduction in the app. If execution is unavailable, report the prerequisite and mark the assumption `unproven`.

Complete when each key assumption has an executed result or a named proof gap. Run [unslop](../unslop/SKILL.md) on the report and remove private data before publishing it.

## Release handoff

Run after the build's checks and before merge. In [Ship verify](../ship/SKILL.md#verify), this is the existing blast-radius lane, with its pinned head and verdict rules. A standalone release-manager run does not replace CI, human approval or Ship's independent verdict.

Return this compact report to the owning T3 thread or release manager:

```md
Blast radius: PASS | ISSUES | INCONCLUSIVE
Scope: <repo, base..head, criteria>
Safety fact: <claim; proven or unproven; evidence level>
Proof: <command, exit status, output or capture link>
Risks: <failure, affected users, likelihood/cost, path:line> or none found
Cleared: <checked cases and evidence>
Before merge: <required fix or missing proof> or none
```

`PASS` requires executed proof for the key facts and no unresolved material risk. `ISSUES` names evidenced breakage; `INCONCLUSIVE` names missing proof. If the head or relevant criteria change, rerun the affected proof before reusing the report. Link it in the merge digest, or in the existing [decision log](../show-me-your-work/SKILL.md) when the run has one.

Adapted from pstack's blast-radius by Lauren Tan (MIT), [cursor/plugins@1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def](https://github.com/cursor/plugins/tree/1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def/pstack). Upstream license: [LICENSE](LICENSE).
