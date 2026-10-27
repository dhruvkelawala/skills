# #107: the isolation rules in verification-skill's SKILL.md, checked at each commit

A scratch checker outside the repo reads `skills/verification-skill/SKILL.md` at a commit and tests that each acceptance criterion's rule is stated where an agent following the skill meets it. Its 49 checks are grouped by criterion: 1 (the template's Hazards and Isolation sections), 2 (create's completion: the inventory against what the replay touched, and the concurrent replay), 3 (process groups and the survivor list), 4 (release means delete), r1 (review pass 1's five fixes) and r2 (review pass 2's fixes). Two "2" checks guard #131's Write sentence and completion clause, so they pass at every commit. Commits are after the rebase onto `2cf5a22`.

Missing checks, by criterion:

| Commit | What it adds | 1 | 2 | 3 | 4 | r1 | r2 | Total missing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `2cf5a22` | base | 15 of 15 | 10 of 12 | 4 of 4 | 8 of 8 | 5 of 5 | 5 of 5 | 47 of 49 missing |
| `c4fe699` | criterion 1 | 0 of 15 | 10 of 12 | 4 of 4 | 8 of 8 | 5 of 5 | 5 of 5 | 32 of 49 missing |
| `1f5afe2` | criterion 2 | 0 of 15 | 0 of 12 | 4 of 4 | 8 of 8 | 5 of 5 | 5 of 5 | 22 of 49 missing |
| `67f2e3c` | criterion 3 | 0 of 15 | 0 of 12 | 0 of 4 | 8 of 8 | 5 of 5 | 5 of 5 | 18 of 49 missing |
| `1558466` | criterion 4 | 0 of 15 | 0 of 12 | 0 of 4 | 0 of 8 | 5 of 5 | 5 of 5 | 10 of 49 missing |
| `b77e27a` | wording, before review | 0 of 15 | 0 of 12 | 0 of 4 | 0 of 8 | 5 of 5 | 5 of 5 | 10 of 49 missing |
| `b4a666b` | review pass 1 fixes | 0 of 15 | 0 of 12 | 0 of 4 | 0 of 8 | 0 of 5 | 5 of 5 | 5 of 49 missing |
| `a128015` | review pass 2 fixes | 0 of 15 | 0 of 12 | 0 of 4 | 0 of 8 | 0 of 5 | 0 of 5 | 0 of 49 missing |

## The checker's lines at the base and at the head

```text
MISS 1 template has a Hazards section
MISS 1 hazard: kill only what this run started
MISS 1 hazard: never drive production, guard fails closed
MISS 1 hazard: user's own install or data, back it up first when the device is theirs
MISS 1 hazard: never print env values, tokens or credential URLs
MISS 1 hazard: bind servers to loopback
MISS 1 template has an Isolation section with an inventory
MISS 1 inventory: ports compiled into builds, started by harnesses, hot reload
MISS 1 inventory: driver sessions, daemons and their state folders
MISS 1 inventory: simulators and devices
MISS 1 inventory: data folders
MISS 1 inventory: single-connection services
MISS 1 inventory: test accounts and channels
MISS 1 inventory columns: claim, busy, release, doctor
MISS 1 Doctor runs the inventory's doctor checks
MISS 2 Run plans isolation with the inventory, not the old four-item list
MISS 2 Record lists every resource a command claimed or created
MISS 2 Write writes Hazards and Isolation
ok   2 #131's pointer sentence kept as it was
ok   2 #131's completion clause kept as it was
MISS 2 replay reports every resource it claimed or created
MISS 2 a resource the inventory doesn't name is a gap
MISS 2 concurrency check: two replays at once
MISS 2 concurrency check: both pass or the second refuses cleanly
MISS 2 one-at-a-time rule names the concurrency check as its exception
MISS 2 completion: the inventory names every resource the replay touched
MISS 2 completion: the concurrent replay passed or refused cleanly
MISS 3 Launch starts the app in its own process group and records it
MISS 3 Cleanup kills the whole group, recorders and browsers included
MISS 3 Cleanup lists survivors and fails when any remain
MISS 3 completion: Cleanup's survivor list was empty
MISS 4 release means delete for what the run created
MISS 4 names simulator, build or derived-data folder, driver state folder, temp data folder
MISS 4 deletes only once the captures check out as nonempty
MISS 4 checks each identity against the ownership file before deleting
MISS 4 deletes nothing it didn't create
MISS 4 lists what it created before deleting and again after
MISS 4 only the captures stay
MISS 4 completion: nothing a replay created is left but its captures
MISS r1 Launch checks the group is the app's own, not the shell's
MISS r1 ownership file marks claimed or created; Cleanup deletes only what is marked created and named for the run
MISS r1 a failed attempt deletes what it created too
MISS r1 the concurrency check is its own step, re-proved by itself, with a refusal as the way out
MISS r1 Run sees the production guard stop a run, and its completion requires it
MISS r2 Share ends: a third collision stops create as incomplete
MISS r2 Share's refusal uses a claim two runs can't both win
MISS r2 Run tests the guard alone, unset and with a name it doesn't allow
MISS r2 Launch compares the group with the PID it started ($!)
MISS r2 Cleanup reads the ownership file first and waits after SIGINT
check-isolation 2cf5a22: 47 of 49 missing

ok   1 template has a Hazards section
ok   1 hazard: kill only what this run started
ok   1 hazard: never drive production, guard fails closed
ok   1 hazard: user's own install or data, back it up first when the device is theirs
ok   1 hazard: never print env values, tokens or credential URLs
ok   1 hazard: bind servers to loopback
ok   1 template has an Isolation section with an inventory
ok   1 inventory: ports compiled into builds, started by harnesses, hot reload
ok   1 inventory: driver sessions, daemons and their state folders
ok   1 inventory: simulators and devices
ok   1 inventory: data folders
ok   1 inventory: single-connection services
ok   1 inventory: test accounts and channels
ok   1 inventory columns: claim, busy, release, doctor
ok   1 Doctor runs the inventory's doctor checks
ok   2 Run plans isolation with the inventory, not the old four-item list
ok   2 Record lists every resource a command claimed or created
ok   2 Write writes Hazards and Isolation
ok   2 #131's pointer sentence kept as it was
ok   2 #131's completion clause kept as it was
ok   2 replay reports every resource it claimed or created
ok   2 a resource the inventory doesn't name is a gap
ok   2 concurrency check: two replays at once
ok   2 concurrency check: both pass or the second refuses cleanly
ok   2 one-at-a-time rule names the concurrency check as its exception
ok   2 completion: the inventory names every resource the replay touched
ok   2 completion: the concurrent replay passed or refused cleanly
ok   3 Launch starts the app in its own process group and records it
ok   3 Cleanup kills the whole group, recorders and browsers included
ok   3 Cleanup lists survivors and fails when any remain
ok   3 completion: Cleanup's survivor list was empty
ok   4 release means delete for what the run created
ok   4 names simulator, build or derived-data folder, driver state folder, temp data folder
ok   4 deletes only once the captures check out as nonempty
ok   4 checks each identity against the ownership file before deleting
ok   4 deletes nothing it didn't create
ok   4 lists what it created before deleting and again after
ok   4 only the captures stay
ok   4 completion: nothing a replay created is left but its captures
ok   r1 Launch checks the group is the app's own, not the shell's
ok   r1 ownership file marks claimed or created; Cleanup deletes only what is marked created and named for the run
ok   r1 a failed attempt deletes what it created too
ok   r1 the concurrency check is its own step, re-proved by itself, with a refusal as the way out
ok   r1 Run sees the production guard stop a run, and its completion requires it
ok   r2 Share ends: a third collision stops create as incomplete
ok   r2 Share's refusal uses a claim two runs can't both win
ok   r2 Run tests the guard alone, unset and with a name it doesn't allow
ok   r2 Launch compares the group with the PID it started ($!)
ok   r2 Cleanup reads the ownership file first and waits after SIGINT
check-isolation a128015: 0 of 49 missing
```
