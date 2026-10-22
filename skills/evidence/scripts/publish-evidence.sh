#!/usr/bin/env bash
# Publish capture files to a dedicated `evidence` orphan branch and print PR-embeddable links.
#
#   publish-evidence.sh --repo owner/name --label <issue-or-branch> [--branch evidence] [--remote origin] <file>...
#
# Files land at <label>/<UTC timestamp>/<basename> on the evidence branch. Each run commits on
# the remote's current tip, whatever this checkout has fetched, in a temporary worktree that
# leaves the checkout untouched. Output: one URL per file,
# https://github.com/<owner>/<name>/blob/<branch>/<path>?raw=true, which renders in PR
# bodies for anyone who can see the repository. Never force-pushes; never touches local branches.
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

heads="$(git -C "$root" ls-remote --heads "$remote")" || { echo "cannot list the branches on $remote" >&2; exit 1; }
parent=""
while read -r sha ref; do
  name="${ref#refs/heads/}"
  if [ "$name" = "$branch" ]; then
    parent="$sha"
  elif [ "${name#"$branch"/}" != "$name" ] || [ "${branch#"$name"/}" != "$branch" ]; then
    echo "branch '$branch' clashes with '$name' on $remote: git cannot keep a branch and another branch nested under its name. Pick another name with --branch." >&2
    exit 1
  fi
done <<< "$heads"

wt="$(mktemp -d)"
trap 'git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"' EXIT
if [ -n "$parent" ]; then
  git -C "$root" fetch -q --refmap= --no-write-fetch-head "$remote" "refs/heads/$branch"
  git -C "$root" worktree add -q --detach --no-checkout "$wt" "$parent"
  git -C "$wt" read-tree "$parent"
else
  git -C "$root" worktree add -q --detach --no-checkout "$wt"
  git -C "$wt" read-tree --empty
  printf '# Evidence\n\nCaptures linked from pull requests. One directory per label and run.\n' > "$wt/README.md"
  git -C "$wt" add README.md
fi

mkdir -p "$wt/$dest"
for f in "${files[@]}"; do cp "$f" "$wt/$dest/"; done
git -C "$wt" add --ignore-removal -- "$dest"
tree="$(git -C "$wt" write-tree)"
commit="$(git -C "$wt" -c user.useConfigOnly=false commit-tree "$tree" ${parent:+-p "$parent"} -m "evidence: $label $stamp (${#files[@]} files)")"
git -C "$wt" push -q "$remote" "$commit:refs/heads/$branch"

for f in "${files[@]}"; do
  echo "https://github.com/$repo/blob/$branch/$dest/$(basename "$f")?raw=true"
done
