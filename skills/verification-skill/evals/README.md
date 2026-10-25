# Evals for verification-skill

Each case is a repo whose verify skill started from `create` and then needed fixing by hand. A run replays `create` on the repo at the commit before its verify skill existed, and scores what it writes against those fixes.

## Run a case

From the repo root:

```sh
node skills/verification-skill/evals/run.mjs lore
```

With no case, `run.mjs` lists the cases. A run takes from about 20 minutes to a few hours of two agents' time. It prints its run folder first and the score last, and appends a section to [results.md](results.md).

It needs macOS, git, node and the claude CLI signed in through environment variables, because each agent gets its own config folder. Disconnect your own phone first, because the agent under test may install on any device it finds.

## What a run does

1. Clones the case's checkout into a new run folder in `~/.cache/verification-skill-evals/`, at the case's base commit, then deletes every ref, reflog and remote. The clone shares the case repo's objects, so it's fast, but no ref leads to a later commit, and nothing done in it reaches the case repo or GitHub. `gh` is off for both agents.
2. Runs `/verification-skill create` in a fresh headless Claude Code. Its config folder holds this skill without this folder, plus the files the skill links to.
3. Stops whatever create left running: each process that carries the run's marker variable, works inside the run folder or names it, the children of those, and each simulator that one of create's commands named. Then it copies what create wrote into the run folder.
4. Runs a fresh grader. The grader gives each lesson `covered`, `partly` or `missing`, quoting the line that covers it, then replays the new skill's launch, doctor, one drive and cleanup.
5. Stops what the replay left running, appends the section to results.md and deletes the checkout. A failed or interrupted run still deletes the checkout and stops its processes, but appends nothing.

The run folder keeps both transcripts, the grade with its quotes and replay notes, and the files create wrote. Don't open a shell inside it during a run, because the sweep would stop it.

## Cases

[lore](cases/lore.md) and [visaroy](cases/visaroy.md). A case file has `Repo`, `Checkout` and `Base` lines and a numbered list under `## Lessons`. Each lesson is a fix that any repo would need, and cites the commit or PR that taught it. `run.mjs` refuses a case with a lesson that cites neither.

## Results

[results.md](results.md) holds scores and verdicts only. Both case repos are private, so quotes and replay notes stay in the run folder. A covered lesson scores 1, a partly covered one 0.5 and a missing one 0. The same skill scores differently from run to run, so score a change more than once before you keep it.

`run.test.mjs` tests the runner with a fake claude: `node --test skills/verification-skill/evals/run.test.mjs`.
