# Evals for verification-skill

Each case is a repo whose verify skill started from `create` and then needed fixing by hand. A run replays `create` at the commit before its verify skill existed, then scores what it writes against those fixes.

## Run a case

From the repo root:

```sh
# Codex is the default. A batch runs three times, one after another.
node skills/verification-skill/evals/run.mjs visaroy
node skills/verification-skill/evals/run.mjs lore --agent codex --runs 3

# Claude remains available for comparisons within that driver.
node skills/verification-skill/evals/run.mjs visaroy --agent claude --runs 3

# Pin the skill source and wait for a quiet machine before each run.
node skills/verification-skill/evals/run.mjs visaroy --skill-ref origin/main --wait-for-idle
```

With no case, the runner lists the cases. `--runs` takes a positive integer and defaults to 3. A run takes about 20 minutes to a few hours of two agents' time. The runner prints its record folder first and score last, then appends one results section for the whole batch. It records every score and starting load, the mean, and the spread, defined as maximum minus minimum. A failed or interrupted batch appends no section; completed runs still have scores in their record folders.

It needs macOS, git and node, plus the selected CLI signed in. Codex uses the `eval` job in [models.json](../../models.json) for both create and grading. Each agent gets a separate Codex home with the skill and linked sign-in from `$CODEX_HOME/auth.json`, or `~/.codex/auth.json`. Sign-in is never copied or printed. Claude uses separate config folders and needs sign-in through environment variables.

### Model availability

When operating the runner, follow [model-policy](../../model-policy/SKILL.md). The default driver and an `--agent` flag you chose yourself are preferences. If that driver is known unavailable, choose the available one before starting. If a batch fails on availability, let the runner finish its cleanup, then invoke the same command with `--agent <available driver>` as a fresh whole batch. Keep the case, run count and skill revision the same. The runner ends the failed batch; you start its replacement.

Each batch uses one driver for both create and grading and records that driver with its scores. Keep completed scores from a failed batch in its record folders; never splice them into the replacement or compare scores across drivers. Use or establish a baseline on the replacement driver. When the user explicitly requires a driver, report its unavailability and resume only on that driver unless the user authorizes fallback. A failed grade, cleanup, app run or safety check follows its normal failure handling.

`--skill-ref` resolves a commit once for the batch and copies the skill and linked files from it. Without it, the runner uses the local skill and marks uncommitted skill changes. The runner itself and model settings come from the checkout running the command.

`--wait-for-idle` waits until the five-minute load average is below 8 and no other `evals/run.mjs`, `xcodebuild`, `cargo` or `expo run` is running. `xcodebuild -license check` is allowed. Use it for baseline and comparison runs. Run Visaroy before Lore, and keep batches sequential.

## What a run does

1. Makes a record folder in `~/.cache/verification-skill-evals/` and a separate temp folder for the agents. It clones the case at its base commit, then deletes every ref, reflog and remote. The clone shares the case repo's objects, but no ref leads to a later commit. `gh` is off for both agents, and git rewrites every push to a path that cannot exist.
2. Runs `/verification-skill create` in a fresh headless agent. Its config folder holds this skill without the evals, plus linked files. Codex uses `codex exec` and its output schema for the grade.
3. Stops processes carrying the run's marker variable, working inside the temp folder or naming it, and their children. It shuts down simulators that create named and booted, then copies create's changes into the record folder.
4. Runs a fresh grader. It marks each lesson `covered`, `partly` or `missing`, quoting the line that covers it, then replays launch, doctor, one drive and cleanup.
5. Stops the replay's processes and simulators, saves the score and load, and deletes the temp folder. After all runs succeed, it appends the batch to [results.md](results.md).

The record folder keeps both transcripts, the grade, score, device refusals and create's files. Do not open a shell inside the temp checkout during a run, because the sweep would stop it. Watching a transcript in the record folder is fine.

## Physical-device guard

Both agents get `xcrun` and `xcodebuild` wrappers first on PATH. They refuse `devicectl device` operations, commands naming a physical device from `xcdevice list`, and build destinations selecting physical hardware. Paired devices count even when unavailable. Other commands, including simulator commands, pass through. If device discovery fails, the guarded commands fail closed. Refusals go to stderr and the run's `device-guard.log`.

The guard does not catch calls to tools by absolute path, or commands that replace PATH. Agents are told to preserve the wrappers, use non-login shells and use simulators only. Never install on or modify a person's phone or its data during an eval. The phone can stay connected.

## Cases and gate

[lore](cases/lore.md) and [visaroy](cases/visaroy.md) have `Repo`, `Checkout` and `Base` lines and numbered lessons under `## Lessons`. Each lesson cites the commit or PR that taught it; the runner refuses uncited lessons.

A case can add `- Toolchain: DEVELOPER_DIR=<path>`. The runner refuses a missing path before starting either agent and passes the pin to create and grading for both drivers. Lore's base commit does not build with the current default Xcode, so its case pins Xcode 26.6, the version current at that commit. As a result, Lore's lesson 1, "pin the toolchain", rarely triggers.

A covered lesson scores 1, a partly covered one 0.5 and a missing one 0. An issue's gate is a mean of three runs per case at least as high as the three-run baseline on the same driver. Keep the individual scores and spread so a lucky run is visible. Claude scores do not compare with Codex scores.

[results.md](results.md) holds scores and verdicts only. Both case repos are private, so quotes and replay notes stay in the record folder. Model names stay in `models.json` and local transcripts.

## Test the runner

```sh
node --test skills/verification-skill/evals/run.test.mjs
```

The tests drive the real CLI with fake Codex, Claude and Apple tools against scratch repos. No real device is used.
