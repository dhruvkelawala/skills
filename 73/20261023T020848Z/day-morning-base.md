# day: the morning report before this change

The same eval, `node --test skills/day/evals/day.eval.mjs`, run against the skill text at the base: SKILL.md has night mode only and there is no morning.md. The `morning.mjs` script from this branch was present, so the agent could call it.

```text
ℹ tests 3
ℹ pass 0
ℹ fail 3
AssertionError [ERR_ASSERTION]: morning: no "Builds to start" section
AssertionError [ERR_ASSERTION]: morning: lines 1 and 3 are not builds to start: NaN,32
AssertionError [ERR_ASSERTION]: morning: no prep record for #7
```

The report the agent improvised: its own section names, stopped runs numbered before builds, no review queue and no prep, no strain line.

```md
Now the stopped threads from the newest night record (2026-10-22 16:48 UTC).

Good morning. One run is still stopped from last night, there are 3 builds ready to start, and 1 PR has gone stale.

**Stopped last night**
1. [Build #12: cache layer](t3-thread://v1/thread-stopped) · stopped at 16:48 UTC at stage 2, building criterion 2 of 3 · `feat/12-cache-layer` at 1a2b3c4, 0 uncommitted files · no PRs

**Ready to build** (`ready-for-agent`, nothing blocking them, not started)
2. [maker/app#31: Rate-limit the export endpoint](https://github.com/maker/app/issues/31) · another issue waits on this one
3. [maker/app#32: Add a --dry-run flag to import](https://github.com/maker/app/issues/32)
4. [maker/app#33: Show the row count after export](https://github.com/maker/app/issues/33)

**Almost ready**
5. [maker/app#34: Onboarding loses people on step two](https://github.com/maker/app/issues/34) · still missing: which screen loses people, and a metric to check a fix against

**Stale PRs**
6. [maker/app#20: Move the config loader to TOML](https://github.com/maker/app/pull/20) · no update for 20 days

No one commented on your merged PRs after they merged.

Reply "go on 1" to restart the cache-layer build.

- **Build #14 isn't listed:** last night's record has it as stopped, but it started a new run at 23:48 UTC, so it's back to work.
- **Old stopped thread:** [Explain the cache](t3-thread://v1/thread-old) was stopped on Oct 20 and never restarted. Tonight's goodnight check will list it under "gone quiet."
- **Report format:** the day skill's instructions only describe the goodnight check. I built this from the morning script's output and what the skill says about reading the night record.
```
