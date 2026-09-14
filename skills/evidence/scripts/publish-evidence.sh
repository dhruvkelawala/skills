#!/usr/bin/env bash
# Publish capture files to a dedicated `evidence` orphan branch and print PR-embeddable links.
#
#   publish-evidence.sh --repo owner/name --label <issue-or-branch> [--branch evidence] [--remote origin] <file>...
#
# Files land at <label>/<UTC timestamp>/<basename> on the evidence branch, committed in a
# temporary worktree so the current checkout is untouched. Output: one URL per file,
# https://github.com/<owner>/<name>/blob/<branch>/<path>?raw=true, which renders in PR
# bodies for anyone who can see the repository. Never force-pushes; never touches other refs.
set -euo pipefail

repo=""; label=""; branch="evidence"; remote="origin"; files=()
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    --branch) branch="$2"; shift 2 ;;
    --remote) remote="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    --*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) files+=("$1"); shift ;;
  esac
done
[ -n "$repo" ] && [ -n "$label" ] && [ ${#files[@]} -gt 0 ] || { echo "usage: $(sed -n '4p' "$0" | sed 's/^# *//')" >&2; exit 2; }
for f in "${files[@]}"; do [ -f "$f" ] || { echo "not a file: $f" >&2; exit 2; }; done
label="$(printf '%s' "$label" | tr -c 'A-Za-z0-9._-' '-' )"

root="$(git rev-parse --show-toplevel)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dest="$label/$stamp"
wt="$(mktemp -d)"
trap 'git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"' EXIT

git -C "$root" fetch -q "$remote" "$branch" 2>/dev/null || true
if git -C "$root" rev-parse -q --verify "refs/remotes/$remote/$branch" >/dev/null; then
  git -C "$root" worktree add -q --detach "$wt" "refs/remotes/$remote/$branch"
  git -C "$wt" checkout -q -B "$branch"
else
  git -C "$root" worktree add -q --detach "$wt"
  git -C "$wt" checkout -q --orphan "$branch"
  git -C "$wt" rm -rfq . >/dev/null 2>&1 || true
  printf '# Evidence\n\nCaptures linked from pull requests. One directory per label and run.\n' > "$wt/README.md"
fi

mkdir -p "$wt/$dest"
for f in "${files[@]}"; do cp "$f" "$wt/$dest/"; done
git -C "$wt" add -A
git -C "$wt" -c user.useConfigOnly=false commit -q -m "evidence: $label $stamp (${#files[@]} files)"
git -C "$wt" push -q "$remote" "$branch:$branch"

for f in "${files[@]}"; do
  echo "https://github.com/$repo/blob/$branch/$dest/$(basename "$f")?raw=true"
done
