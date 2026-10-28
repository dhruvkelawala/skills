---
name: model-policy
description: Use when selecting a model for a skill's helper, review or verification, or when a provider is unavailable, out of quota or rate-limited. Keeps work moving with the available model family while preserving independent reviews.
---

# Model policy

Use this policy for every skill's model selection, including outside skills. It takes precedence over their engine preferences and instructions to wait on model availability. Follow the host's tool-routing rules and the user's explicit restrictions.

## Choose and continue

Read [models.json](../models.json) for the job's preferred entry and `ifUnavailable`. Resolve it from the real parent of this skill's folder (`cd -P <this skill's folder>/.. && pwd`), so installed symlinks reach the same file. Match jobs by their `for` descriptions; a helper with no matching job starts on the thread's model. The preferences still apply while those models can run.

When the preferred entry is unavailable, continue on the available family without asking for confirmation. On a Codex thread with Claude unavailable, keep using Codex. On a Claude thread with Codex unavailable, keep using Claude. This applies to an engine selected by name too, unless the user explicitly requires that engine only, a particular model only, or a cross-family result.

- `thread` runs the job in a fresh helper on the thread's model and settings. For an autoreview engine, use the `second-opinion` entry whose `engine` matches the thread's family. If the thread's family cannot run helpers either, use the other configured family when available.
- `skip` omits an unavailable council member and reports the reduced membership. A council can use one family. Keep at least two independent members, each in a fresh context; when fewer survive, fill the missing seats with fresh helpers from the available family. Report repeated models as separate passes, not distinct models.

For the `eval` job, a default driver is a preference. Follow the [evaluation instructions](../verification-skill/evals/README.md) to choose an available driver or, after an availability failure and cleanup, start a fresh whole batch on it. Keep the case, source revision and run count; label the new batch with its actual driver and compare it with a baseline from that driver. Keep completed scores from the failed batch in its own records. An explicit user requirement to keep one driver still holds.

Use the host's supported delegation route for the chosen model and settings. An independent reviewer or verifier always gets a fresh context and the same scope, evidence and required checks. The author cannot replace it with self-review. A required review that cannot run on either family remains incomplete.

## Recognize unavailability

Missing provider or CLI, an inaccessible model, expired sign-in, exhausted account quota, a rate limit, or an explicit capacity or service-unavailable error triggers fallback. A user-reported outage or quota exhaustion is enough to skip that route. For an ambiguous transient transport failure, retry once, then fall back only when the failure is an availability problem.

Once a route is known unavailable, remember the reason and any reset time for this run and its later turns. Skip it in subsequent jobs and council rounds until the reset, the user reports recovery, or new capability evidence shows it can run. Treat an account-wide quota failure as affecting every model on that account; a missing single model affects that entry. Stop or cancel a still-running attempt before replacing it. Every replacement delegate review is a new task.

Slow progress alone does not establish unavailability. Findings, failed tests, missing review context, isolation failures, invalid output and incomplete coverage retain their existing handling. Fallback cannot turn any of those into a pass or discard an earlier finding.

## Autoreview

Keep the existing helper and its isolation, target, base SHA, context and severity. After a confirmed availability failure, run that helper again with the available family's `--engine`, `--model` and supported `--thinking` flags. Rebuild engine-specific flags for the replacement. Use fresh report and status paths outside the checkout. This is a new attempt of the same review, not an extra review pass after a completed result.

The helper's own account-access retry can finish first. Record the model it actually reports, including any `retrying with <model>` line. A partial or failed attempt never counts as a clean review. When the replacement cannot run either, report the review gap and both failures; preserve the workflow's completion gate.

## Record the result

Say once why the preferred route was unavailable and which engine, model and effort replaced it. Put the same facts in the workflow's existing run record, prep record or verdict notes, with the reviewed head or tree. A same-family review satisfies an independent-review requirement, but its report must say that cross-family coverage was unavailable. Claim a clean review or passing verdict only after all of its normal checks finish.

If the user explicitly requires the unavailable family or model, report that exact unmet requirement and continue any work that does not depend on it. Model fallback changes no GitHub approval, required CI, hosted bot-review or merge rule.
