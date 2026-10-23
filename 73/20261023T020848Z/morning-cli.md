# day: scripts/morning.mjs, at a874fd5

The GitHub half of the morning report: `node skills/day/scripts/morning.mjs` prints `builds`, `almostReady`, `stale` and `lateComments` as JSON, through search and REST calls only.

## Tests, gh faked on PATH

Red, with a stub that printed four empty lists:

```text
actual: [],
✖ almost ready lists open unlabelled issues with ticket's What's missing section, and its gaps (33.509417ms)
✖ builds to start are ready, unblocked, unstarted issues in your repos or involving you, ranked by what they unblock, then oldest (37.775083ms)
✖ failing tests:
✖ going stale lists your open PRs with no update for 14 days, stalest first (31.791083ms)
✖ late comments are what others wrote on your PRs after they merged in the last 7 days, newest first (36.805959ms)
ℹ tests 4
ℹ pass 0
ℹ fail 4
```

Red, the failed-read test with the failure path swapped for "print empty lists, exit 0":

```text
actual: 0,
expected: 2,
```

Green at `a874fd5`, `node --test skills/day/scripts/morning.test.mjs`:

```text
✔ builds to start are ready, unblocked, unstarted issues in your repos or involving you, ranked by what they unblock, the repo pushed to last, then oldest (426.136167ms)
✔ almost ready lists open unlabelled issues with ticket's What's missing section, and its gaps (350.121583ms)
✔ going stale lists your open PRs with no update for 14 days, the one that went quiet last first (212.153958ms)
✔ late comments are what people and review bots wrote on your PRs after they merged in the last 7 days, newest first (243.048083ms)
✔ a GitHub read that fails exits 2 with the error and prints no lists (256.684625ms)
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

## A read-only live run

Against the account this skill is built for, at `a874fd5`. The lists name private and work repositories, so only the counts are shown.

```text
$ node skills/day/scripts/morning.mjs | jq "map_values(length)"
{"builds":49,"almostReady":1,"stale":34,"lateComments":0}
exit 0 in 22 s
```

The first live run, before the ranking rules changed, showed why they did: oldest-first put a dormant project's May issues at the top of 49 builds, stalest-first put PRs quiet for 260 days at the top of 34, and the one late comment was a CI bot's deploy notice. Builds now rank by what they unblock, then the repository pushed to last, then age; going stale shows the PR that went quiet last first; a bot's plain comment is not a late comment.
