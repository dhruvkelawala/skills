# Criterion 9: queries against the live project (head eae75df; query code unchanged since)

`T3_THREADS_CONFIG=<private> node instrumentation/threads/cli.mjs report 2026-11-18T00:00:00Z 2026-11-19T13:00:00Z`, summarised:

- cost per thread: 104 threads, all priced
- cost per lineage tree: 39 trees, 10 spanning more than one thread, the largest 19 threads (launcher and lineageParent come back on v2 observation rows)
- compactions per thread: 40 compactions in 25 threads, 0 handoffs in the window
- Fable 5.2 price: 478 claude-fable-5-2 generations priced after `cli.mjs models`; 74 generations without a model name (Codex requests before any turn_context) stay unpriced
