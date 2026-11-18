# Criterion 6: compare after 10 runs with the 1-11 Nov baseline; roll back on an accepted P0/P1 caused by a post-reset repair
head 0149e43f1cf86d69a0928687b19a84e46f9c55eb tree 64fcff310663c9de4c476ba1edbc4ddb5f6aa88b

## Context reset rollout

After 10 runs that reset their context at stage 5, compare them with the 1 to 11 November 2026 baseline of runs without it: the context size of each watch wake and the handoff, the cost per run from the captured usage, and the repair outcomes. The `context-reset` markers and each run's `first request after the reset` line find the runs; the user makes the comparison. Roll the reset back, by reverting its stage 5 step, when a repair made after a reset causes an accepted P0 or P1.

The comparison itself is a post-merge human gate (contract: Human gates).
