#!/usr/bin/env bash
# Run one Python job on a fresh Google Colab runtime with the official Colab CLI,
# then always stop the runtime, including on error or interrupt.
#
# Usage:
#   colab-job.sh [--gpu L4] [--timeout 600] [--name NAME] [--in LOCAL=REMOTE ...] \
#                [--out REMOTE=LOCAL ...] SCRIPT.py
#
# --gpu       L4 (default), A100, G4, H100, or "cpu". Never T4.
# --timeout   seconds the script may stay silent before the CLI fails it (default 600).
#             Print progress at least that often.
# --in        upload a local file before running (repeatable). Remote paths go under /content.
# --out       download a remote file after running (repeatable). Tried even if the script fails.
# Prints the compute-unit balance before and after, and checks no session is left.
set -uo pipefail

gpu=L4 timeout=600 name="job-$(date +%Y%m%d%H%M%S)-$$"
ins=() outs=()
while [[ $# -gt 1 ]]; do
  case "$1" in
    --gpu) gpu=$2; shift 2 ;;
    --timeout) timeout=$2; shift 2 ;;
    --name) name=$2; shift 2 ;;
    --in) ins+=("$2"); shift 2 ;;
    --out) outs+=("$2"); shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
script=${1:?usage: colab-job.sh [options] SCRIPT.py}
[[ -f $script ]] || { echo "no such script: $script" >&2; exit 2; }
for pair in ${ins[@]+"${ins[@]}"}; do [[ -f ${pair%%=*} ]] || { echo "no such input: ${pair%%=*}" >&2; exit 2; }; done
command -v colab >/dev/null || { echo "colab CLI missing: uv tool install google-colab-cli" >&2; exit 2; }

echo "== balance before"; colab usage </dev/null || { echo "colab usage failed: sign-in needed?" >&2; exit 3; }

started=0
stop() {
  if [[ $started == 1 ]]; then
    echo "== stop $name"; colab stop -s "$name" || echo "WARNING: colab stop failed; check 'colab sessions' now" >&2
  fi
  echo "== sessions left"; colab sessions
  echo "== balance after"; colab usage
}
trap stop EXIT
trap 'exit 130' INT TERM

[[ $(printf %s "$gpu" | tr a-z A-Z) == T4 ]] && { echo "T4 is not allowed; use L4 or better (H100 > G4 > A100 > L4)" >&2; exit 2; }
accel=(--gpu "$gpu"); [[ $gpu == cpu ]] && accel=()
echo "== new $name (${gpu})"
started=1
colab new -s "$name" ${accel[@]+"${accel[@]}"} || exit 4
colab status -s "$name"
for pair in ${ins[@]+"${ins[@]}"}; do colab upload -s "$name" "${pair%%=*}" "${pair#*=}" || exit 5; done

# colab exec can exit 0 even when the script raises, so run the job inside a
# harness that prints an explicit marker, and judge success by that marker.
work=$(mktemp -d)
cat > "$work/harness.py" <<'PY'
import runpy, sys, traceback
sys.argv = ["/content/_job.py"]
try:
    runpy.run_path("/content/_job.py", run_name="__main__")
    print("__COLAB_JOB_OK__", flush=True)
except SystemExit as e:
    print("__COLAB_JOB_OK__" if e.code in (0, None) else f"__COLAB_JOB_FAILED__ exit {e.code}", flush=True)
except BaseException:
    traceback.print_exc()
    print("__COLAB_JOB_FAILED__", flush=True)
PY
colab upload -s "$name" "$script" /content/_job.py || exit 5
echo "== run $script"
colab exec -s "$name" -f "$work/harness.py" --timeout "$timeout" 2>&1 | tee "$work/run.log"
if grep -q '^__COLAB_JOB_OK__' "$work/run.log"; then rc=0
else echo "JOB FAILED (no success marker; see output above)" >&2; rc=1; fi
rm -rf "$work"

for pair in ${outs[@]+"${outs[@]}"}; do
  mkdir -p "$(dirname "${pair#*=}")"
  colab download -s "$name" "${pair%%=*}" "${pair#*=}" || { echo "download failed: ${pair%%=*}" >&2; [[ $rc == 0 ]] && rc=6; }
done
exit "$rc"
