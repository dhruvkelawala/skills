---
name: colab-gpu-job
description: Use for /colab-gpu-job, or a request to run a heavy Python job (transcription, upscaling, fine-tunes, evals, model bake-offs) on a Google Colab GPU with Google's official Colab CLI, from the terminal and unattended. Checks the compute-unit balance, uploads inputs, runs, downloads outputs, always shuts the runtime down, and reports units used. Needs a signed-in Colab account.
---

# Colab GPU job

Run one job on a fresh Colab runtime and leave nothing running. Uses the official CLI
`google-colab-cli` (github.com/googlecolab/google-colab-cli; `colab` command). Never use
cookie-scraping or unofficial Colab clients.

## Before you start

1. `command -v colab || uv tool install google-colab-cli`
2. `colab usage` shows the balance and active assignments. If it prints a Google sign-in URL
   instead, the account isn't signed in: stop and ask the account owner to sign in. The CLI uses a
   copy-paste flow: the owner opens the URL, picks the account and approves, then the one-time code
   Google shows goes to the CLI's prompt. Never ask for a password or the code in chat, and never print,
   log or commit the code; the refresh token is kept in the OS keychain.
3. If `Active assignments` is not 0, run `colab sessions` and find out whose runtime it is before
   starting another one. Don't stop runtimes you didn't start without asking.

## Choose the hardware

- Never use `T4`. GPU priority: `H100` > `G4` > `A100` > `L4` (minimum). Use `cpu` for jobs that only
  need a remote CPU.
- If Colab can't assign a GPU (e.g. "Service Unavailable"), retry down the priority list every few
  minutes and wait; don't fall back to `T4`.
- Ask the user before any job expected to use more than ~25 units (an H100 burns roughly 18 units an
  hour; rates are user-measured, not published). Size each job to what it needs; don't hold back below that just to save
  units (paid plans refill monthly, and Colab says units expire after 90 days).
- Never buy units, change the plan, or open `colab pay`. If the balance is too low, stop and report it.
- Follow Colab's terms: no crypto mining, no proxying, no long-running servers.

## Run it

Use the bundled wrapper. It checks the balance, allocates the runtime, uploads inputs, runs the
script, downloads outputs (even if the script fails), then stops the runtime and confirms with
`colab sessions` on every exit path, including errors and Ctrl-C:

```bash
scripts/colab-job.sh --gpu L4 --timeout 600 \
  --in ./audio.wav=/content/audio.wav \
  --out /content/transcript.txt=./out/transcript.txt \
  job.py
```

Write `job.py` so that it:
- reads inputs from `/content/...` and writes outputs to `/content/...`;
- installs its own packages at the top (`subprocess.run([sys.executable, "-m", "pip", "install", "-q", ...], check=True)`);
- prints progress with `flush=True` at least once per `--timeout` seconds. The CLI fails a run that
  stays silent longer than that, so raise `--timeout` for long silent steps;
- starts by printing `nvidia-smi` output so the log shows which GPU it got.
- for model comparisons, loads each model in its own runtime, since leftover GPU memory from an earlier
  model causes out-of-memory failures. Load models in 4-bit (nf4) on an L4 and generate in small batches
  (about 8) so they fit.

For many short runs against the same data (an experiment loop), keep one session instead of the
wrapper: set it up once, upload only the changed files per run, keep logs and results locally so a
dropped session loses nothing, and `colab stop` it when the loop ends. Compare runs only on the same GPU
type; re-run the baseline if the session comes back on a different one.

Success means the wrapper exits 0. `colab exec` can exit 0 even when the script raises, so the
wrapper runs the job in a harness and treats a missing `__COLAB_JOB_OK__` line as failure (exit 1).

Without the wrapper, the same steps are: `colab new -s NAME --gpu L4`, `colab upload`,
`colab exec -s NAME -f job.py --timeout N`, `colab download`, then `colab stop -s NAME`. Put the
`colab stop` in a shell `trap ... EXIT` so it runs on errors too.

## Verify and report

- Confirm `colab sessions` prints "No active sessions found on server". If a stop failed, retry
  `colab stop -s NAME` and check again before you report.
- Before scaling a run, check the yield per completion (usable items per attempt) on the raw output,
  since a parser can silently drop most of the output. Fix the parser or prompt and rerun a small
  sample before the full run.
- Report: GPU line from `nvidia-smi`, outputs brought back (paths), wall time, and units used.
- Units: compare the balance before and after. The balance can lag or round away short runs (a
  minute of L4 may show no change), so also give an estimate: runtime minutes × the hardware's hourly rate
  (`colab usage` while the runtime is up, or Colab's pricing page). Say it is an estimate.
- Keep inputs and outputs local. Don't upload the user's private files unless the task asks for it.
