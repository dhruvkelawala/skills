# Criteria 1, 4, 5, 6: live readback from the t3-threads project (head 86f01ac)

ClickHouse `events_full` for the project, counted (no titles, branches or IDs):

```
sessions:        3385
t3_sessions:     2807   (trace metadata t3 = true; the other 578 are sessions T3 does not know, t3 = false)
with_title:      2807
with_project:    2807
with_branch:     2672   (threads without a branch have none to send)
with_lineage:    2807
with_launcher:   2602
with_workflow:   1997   (own issue-to-pr branch match, or inherited from launcher / lineage parent)
tool_rows:       995052
compaction_rows: 3350
handoff_rows:    29
```

Pass and backfill results report pending 0, exhausted 0, unavailable 0 (criterion 1). Compactions and handoffs are separate kinds (criterion 5). Tool spans carry name, duration and error flag (criterion 6); the no-content proof is the canary test and the synthetic CLI capture.
