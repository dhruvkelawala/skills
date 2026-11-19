# Criterion 7: pass timing on real transcripts (head 38a5774, local sink, not Langfuse)

- cold pass over the last day (since now-24h, empty state): 60.8 s, 122 transcripts, 684 MB read, 11,963 spans, 0 unavailable/pending/exhausted, 494 MB peak RSS.
- the next pass (steady state, cursors kept): 0.41 s, 2 transcripts, 14,386 bytes read, 2 spans.
- 30-day backfill for scale: 148 s over 4,197 transcripts and 18.2 GB.

All inside the 5-minute schedule. Live timing against Langfuse and the `ensure` line are pending Dhruv's go-ahead.
