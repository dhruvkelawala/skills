# Evidence and confidence

Read before synthesis. A useful answer can end in "unknown"; a plausible story is not a historical finding.

## Tiers

- **Direct:** explicit author text states the rationale. Quote and cite it. "This exists because X" is justified only for the scope the text actually covers.
- **Supported:** multiple independent indirect items converge. Say "The evidence points strongly to X" and cite what each contributes. A doc and a PR repeating that doc are one lineage, not two independent witnesses.
- **Inferred:** a reasonable interpretation, not recorded intent. Say "Given A and B, C seems likely" and expose the inference step with citations to A and B.
- **Speculative:** several explanations fit thin evidence. Say "One possibility is X; no direct evidence establishes it." List supporting, contrary, and missing evidence where useful.
- **Unknown:** searches did not resolve the question. Name sources, queries, windows, and access limits. An unavailable record is not a negative search result.

## Calibration

Use "because", "the reason", "was designed to", or "the team decided" only with adjacent evidence for causation or intent. Code, test behavior, and measured telemetry can establish what happens, not why the author chose it. A test description or comment that explicitly explains a constraint can establish that stated constraint; an assertion alone cannot.

Distinguish recorded goals from demonstrated outcomes. A PR saying "fixes timeouts" records the goal; it does not establish that timeouts stopped. A post-release metric drop is circumstantial unless competing changes, instrumentation, sampling, and retention are accounted for.

Compare sources' dates and status. Draft plans, later recollections, and current mechanics may differ. Quote conflicting sources together rather than smoothing them into a single decision. Do not assume a consistent pattern was intentional, the latest edit created the policy, or the current design was the right choice. Test the user's proposed explanation independently.

Keep gaps concrete: what remains unanswered, where you looked, what came back, and which record or person could resolve it. No evidence found is not evidence that a concern never existed.

## Final check

1. Every Direct/Supported claim has an original, verified citation that bears on that exact claim.
2. Inferences are hedged, with visible premises; guesses remain labeled.
3. Mechanics are separate from intent, and goals from achieved effects.
4. Contradictions, premise corrections, null searches, and access limits are visible.
5. The summary preserves confidence instead of upgrading it for a cleaner story.
