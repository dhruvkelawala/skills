#!/usr/bin/env bash
# Read-only: lists build artifacts under a code root and package-manager caches under $HOME.
set -u
export GIT_OPTIONAL_LOCKS=0 GIT_TERMINAL_PROMPT=0

if [ "$#" -gt 1 ]; then
    printf 'Expected at most one code-root argument\n' >&2
    exit 1
fi
if [ "${1:-}" = --help ]; then
    printf 'Usage: %s [code-root] (default: current repo)\n' "$0"
    exit 0
fi
root=${1:-$(git rev-parse --show-toplevel 2>/dev/null)}
[ -d "$root" ] || { printf 'Not a directory: %s\n' "$root" >&2; exit 1; }
artifacts=0
caches=0

row() {
    local kind=$1 name=$2 bucket=$3 clean=$4 worktree=$5 path=$6 size
    size=$(du -sk "$path" 2>/dev/null | awk 'NR == 1 {print $1}')
    printf '%s\t%s\t%s\t%s\t%s\t%q\t%q\n' "$kind" "$name" "${size:-UNKNOWN}" "$bucket" "$clean" "$worktree" "$path"
}

artifact_row() {
    local path=$1 worktree bucket
    if worktree=$(git -C "${path%/*}" rev-parse --show-toplevel 2>/dev/null); then
        # Git reports a directory as not ignored when it is not ignored or tracks files in it.
        if git -C "$worktree" check-ignore -q -- "$path"; then bucket=CANDIDATE-CHECK-USAGE
        else bucket=HOLD-NOT-IGNORED; fi
    else
        worktree=- bucket=HOLD-OUTSIDE-GIT
    fi
    row artifact "${path##*/}" "$bucket" delete "$worktree" "$path"
    artifacts=$((artifacts + 1))
}

printf 'KIND\tNAME\tSIZE_KIB\tBUCKET\tCLEAN\tWORKTREE\tPATH\n'
while IFS= read -r -d '' path; do
    artifact_row "$path"
done < <(find "$(cd "$root" && pwd -P)" -name .git -prune -o -type d \
    \( -name node_modules -o -name target -o -name .next -o -name .turbo \) -prune -print0)

derived="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$derived" ]; then
    row artifact DerivedData CANDIDATE delete - "$derived"
    artifacts=$((artifacts + 1))
fi

# Default locations only, macOS then Linux. CLEAN is the tool's own command, or `delete` for the path.
while IFS='|' read -r name clean path; do
    [ -d "$HOME/$path" ] || continue
    row cache "$name" CANDIDATE "$clean" - "$HOME/$path"
    caches=$((caches + 1))
done <<'EOF'
npm|npm cache clean --force|.npm/_cacache
pnpm|pnpm store prune|Library/pnpm/store
pnpm|pnpm store prune|.local/share/pnpm/store
yarn|delete|Library/Caches/Yarn
yarn|delete|.cache/yarn
yarn|delete|.yarn/berry/cache
bun|bun pm cache rm|.bun/install/cache
go-build|go clean -cache|Library/Caches/go-build
go-build|go clean -cache|.cache/go-build
go-mod|go clean -modcache|go/pkg/mod
pip|pip3 cache purge|Library/Caches/pip
pip|pip3 cache purge|.cache/pip
uv|uv cache clean|.cache/uv
homebrew|brew cleanup --prune=all|Library/Caches/Homebrew
homebrew|brew cleanup --prune=all|.cache/Homebrew
cocoapods|pod cache clean --all|Library/Caches/CocoaPods
cargo|delete|.cargo/registry
gradle|delete|.gradle/caches
EOF

printf 'SUMMARY artifacts=%s caches=%s (read-only; nothing removed)\n' "$artifacts" "$caches" >&2
