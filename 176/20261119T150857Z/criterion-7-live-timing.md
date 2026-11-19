# Criterion 7: pass timing against the live project (head 86f01ac)

```
14:47:30 catch-up pass 1 163s {"status":"passed","transcripts":4329,"bytes":18750017140,"events":668602,"copied":1516,"deferred":0,"unavailable":0,"t3":"available","pending":0,"exhausted":0}
14:52:11 steady pass 1 1s {"status":"passed","transcripts":5,"bytes":1944815,"events":118,"copied":0,"deferred":0,"unavailable":0,"t3":"available","pending":0,"exhausted":0}
14:56:55 steady pass 2 4s {"status":"passed","transcripts":6,"bytes":4118330,"events":120,"copied":0,"deferred":0,"unavailable":0,"t3":"available","pending":0,"exhausted":0}
```

A first pass over 30 days with empty cursors fits the 4-minute budget; steady-state passes take seconds. `ensure` runs the pass every 5 minutes after merge (guarded on the file existing in skills-installed-main).
