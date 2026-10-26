# #117: what Create step 4 tells the agent, before and after

Two scratch checks, run from the repo root. Neither is committed.

- `check-replay.mjs <rev>` reads Create step 4 (Replay) of `skills/verification-skill/SKILL.md` at a commit and checks its wording: "1" lines are criterion 1 (sort into gaps and nits), "2" lines are criterion 2 (stop after a replay with no gap or after the third), "kept" lines are rules from #118 that must survive.
- `sort-check.mjs <rev> <report...>` gives a fresh headless Claude (`claude -p`, no tools, fresh config) Create step 4 at that commit and one real replay report from Lore's capped eval run at 7510046 (the base text), tells it which replay this was, and asks for JSON `{gaps, nits, next}`. It prints only the counts and the decision, because the reports hold private-repo content. Report 1 had two steps that failed as written. Reports 4, 5 and 6 passed every step.

## check-replay

```text
MISS 1 a gap is a step that failed as written
MISS 1 or a choice where another could have failed a step or let it pass without proving what it claims
MISS 1 everything else is a nit, such as a capture's file name or a precaution
MISS 1 only a gap earns another replay
MISS 1 a nit fix runs and records any command it adds
MISS 1 the replay reports what it chose and why
MISS 1 no longer: every question and improvised step is a gap
MISS 2 stop after the first replay with no gap
MISS 2 or after the third replay you start
MISS 2 after the third, name each fix no replay ran
MISS 2 no longer: until a replay needs nothing
MISS 2 completion: no gap, or the third replay
MISS 2 completion: no longer 'no question and nothing improvised'
ok   kept: replay runs in the foreground
ok   kept: a feature a replay can't drive moves to Not mapped yet
ok   kept: last replay's captures survived cleanup
29dd9cb: 13 of 16 missing
```

```text
ok   1 a gap is a step that failed as written
ok   1 or a choice where another could have failed a step or let it pass without proving what it claims
ok   1 everything else is a nit, such as a capture's file name or a precaution
MISS 1 only a gap earns another replay
MISS 1 a nit fix runs and records any command it adds
MISS 1 the replay reports what it chose and why
ok   1 no longer: every question and improvised step is a gap
MISS 2 stop after the first replay with no gap
MISS 2 or after the third replay you start
MISS 2 after the third, name each fix no replay ran
ok   2 no longer: until a replay needs nothing
MISS 2 completion: no gap, or the third replay
ok   2 completion: no longer 'no question and nothing improvised'
ok   kept: replay runs in the foreground
ok   kept: a feature a replay can't drive moves to Not mapped yet
ok   kept: last replay's captures survived cleanup
796fed7: 7 of 16 missing
```

```text
ok   1 a gap is a step that failed as written
ok   1 or a choice where another could have failed a step or let it pass without proving what it claims
ok   1 everything else is a nit, such as a capture's file name or a precaution
MISS 1 only a gap earns another replay
MISS 1 a nit fix runs and records any command it adds
MISS 1 the replay reports what it chose and why
ok   1 no longer: every question and improvised step is a gap
ok   2 stop after the first replay with no gap
MISS 2 or after the third replay you start
ok   2 after the third, name each fix no replay ran
ok   2 no longer: until a replay needs nothing
ok   2 completion: no gap, or the third replay
ok   2 completion: no longer 'no question and nothing improvised'
ok   kept: replay runs in the foreground
ok   kept: a feature a replay can't drive moves to Not mapped yet
ok   kept: last replay's captures survived cleanup
44c6073: 4 of 16 missing
```

```text
ok   1 a gap is a step that failed as written
ok   1 or a choice where another could have failed a step or let it pass without proving what it claims
ok   1 everything else is a nit, such as a capture's file name or a precaution
ok   1 only a gap earns another replay
ok   1 a nit fix runs and records any command it adds
ok   1 the replay reports what it chose and why
ok   1 no longer: every question and improvised step is a gap
ok   2 stop after the first replay with no gap
ok   2 or after the third replay you start
ok   2 after the third, name each fix no replay ran
ok   2 no longer: until a replay needs nothing
ok   2 completion: no gap, or the third replay
ok   2 completion: no longer 'no question and nothing improvised'
ok   kept: replay runs in the foreground
ok   kept: a feature a replay can't drive moves to Not mapped yet
ok   kept: last replay's captures survived cleanup
4b75cd5: 0 of 16 missing
```

## sort-check: told it was the second replay

Base text (every question and improvised step is a gap):

```text
29dd9cb:
replay 1: next=replay again, gaps=11, nits=2, model=claude-opus-5-5
replay 4: next=replay again, gaps=14, nits=0, model=claude-opus-5-5
replay 5: next=replay again, gaps=10, nits=0, model=claude-opus-5-5
replay 6: next=replay again, gaps=4, nits=3, model=claude-opus-5-5
```

After the sort (criterion 1) and after review's repair:

```text
796fed7:
replay 1: next=replay again, gaps=8, nits=8, model=claude-opus-5-5
replay 4: next=replay again, gaps=3, nits=11, model=claude-opus-5-5
replay 5: next=replay again, gaps=1, nits=8, model=claude-opus-5-5
replay 6: next=replay again, gaps=1, nits=6, model=claude-opus-5-5
```

```text
4b75cd5:
replay 1: next=replay again, gaps=7, nits=6, model=claude-opus-5-5
replay 4: next=replay again, gaps=3, nits=10, model=claude-opus-5-5
replay 5: next=replay again, gaps=1, nits=8, model=claude-opus-5-5
replay 6: next=replay again, gaps=1, nits=6, model=claude-opus-5-5
```

Each of replays 4 to 6 still had a real gap under the new sort, so "replay again" is the right answer there: a build step that says "run it in the background" with no command, which a foreground run could time out; a wait that passes while a sheet is still open; and an absence check with no wait after launch, which can pass before a poster opens. The naming questions the issue lists (capture names, the Metro disagreement, a tap with no command) moved to nits. The cap is what bounds Lore.

## sort-check: told it was the third replay

```text
29dd9cb:
replay 4: next=replay again, gaps=14, nits=0, model=claude-opus-5-5
replay 3: next=replay again, gaps=8, nits=0, model=claude-opus-5-5
44c6073:
replay 4: next=stop, gaps=3, nits=10, model=claude-opus-5-5
replay 3: next=stop, gaps=3, nits=5, model=claude-opus-5-5
4b75cd5:
replay 4: next=stop, gaps=4, nits=10, model=claude-opus-5-5
replay 3: next=stop, gaps=2, nits=6, model=claude-opus-5-5
```
