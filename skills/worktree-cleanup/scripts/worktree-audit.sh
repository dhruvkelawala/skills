#!/usr/bin/env bash
# Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
# Read-only: no fetch, index refresh, temp files, or cleanup commands.
set -u
export GIT_OPTIONAL_LOCKS=0 GIT_TERMINAL_PROMPT=0

if [ "$#" -gt 1 ]; then
    printf 'Expected at most one repo-or-directory argument\n' >&2
    exit 1
fi
if [ "${1:-}" = --help ]; then
    printf 'Usage: %s [repo-or-directory] (default: current repo)\n' "$0"
    exit 0
fi
root=${1:-$(git rev-parse --show-toplevel 2>/dev/null)}
[ -d "$root" ] || { printf 'Not a directory: %s\n' "$root" >&2; exit 1; }
now=$(date +%s)
seen=("")
repos=0
rows=0
errors=0
skipped=0

worktree_row() {
    local wt=$1 head=$2 branch=$3 locked=$4 primary=$5
    local size age ts merged merge_status dirty status tracked untracked ignored remote_state tip unpushed bucket
    size=$(du -sk "$wt" 2>/dev/null | awk 'NR == 1 {print $1}')
    size=${size:-UNKNOWN}
    ts=$(git -C "$wt" log -1 --format=%ct "$head" 2>/dev/null) || ts=0
    age=UNKNOWN
    if [ "$ts" -gt 0 ]; then
        age=$(( (now - ts) / 86400 ))
        [ "$age" -ge 0 ] || age=0
    fi
    merged=UNKNOWN
    if [ -n "$default_ref" ] && git -C "$repo" cat-file -e "$head^{commit}" 2>/dev/null; then
        git -C "$repo" merge-base --is-ancestor "$head" "$default_ref" 2>/dev/null
        merge_status=$?
        case "$merge_status" in 0) merged=YES ;; 1) merged=NO ;; esac
    fi
    dirty=UNKNOWN
    if status=$(git -c core.quotePath=true -C "$wt" status --porcelain --ignored=matching 2>/dev/null); then
        tracked=$(printf '%s\n' "$status" | awk 'NF && !/^\?\?/ && !/^!!/ {n++} END {print n+0}')
        untracked=$(printf '%s\n' "$status" | awk '/^\?\?/ {n++} END {print n+0}')
        ignored=$(printf '%s\n' "$status" | awk '/^!!/ {n++} END {print n+0}')
        dirty="tracked:$tracked,untracked:$untracked,ignored:$ignored"
    fi
    remote_state=UNKNOWN
    unpushed=UNKNOWN
    tip=
    if [ -z "$branch" ]; then
        remote_state=detached
    elif [ "$remote_ok" = yes ]; then
        tip=$(printf '%s\n' "$remote_refs" | awk -v ref="refs/heads/$branch" '$2 == ref {print $1; exit}')
        if [ -n "$tip" ]; then
            remote_state=present
        elif git -C "$repo" show-ref --verify --quiet "refs/remotes/$remote/$branch"; then
            remote_state=absent-previously-tracked
        else
            remote_state=absent-deleted-or-never-pushed
        fi
    elif [ -z "$remote" ]; then
        remote_state=no-remote
    fi
    if [ "$tip" = "$head" ] && [ -n "$head" ]; then
        unpushed=0
    elif [ -n "$tip" ] && git -C "$repo" cat-file -e "$tip^{commit}" 2>/dev/null; then
        unpushed=$(git -C "$repo" rev-list --count "$tip..$head" 2>/dev/null) || unpushed=UNKNOWN
    elif [ "$remote_ok" = yes ] && [ -z "$tip" ]; then
        unpushed=$(git -C "$repo" rev-list --count "$head" --not --remotes 2>/dev/null) || unpushed=UNKNOWN
        unpushed="$unpushed(cached-unpublished)"
    fi
    bucket=REVIEW
    if [ "$primary" = yes ]; then bucket=PRIMARY
    elif [ "$locked" = yes ]; then bucket=HOLD-LOCKED
    elif [ "$dirty" = UNKNOWN ]; then bucket=HOLD-UNKNOWN
    elif [ "$tracked" -gt 0 ] || [ "$untracked" -gt 0 ]; then bucket=HOLD-DIRTY
    elif [ "$unpushed" != 0 ]; then bucket=HOLD-UNPUSHED-OR-UNKNOWN
    elif [ "$merged" = YES ]; then bucket=CANDIDATE-CHECK-USAGE
    fi
    printf '%q\t%q\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$repo" "$wt" "${branch:-DETACHED}" "$size" "$age" "$merged" "$dirty" "$unpushed" "$remote_state" "$bucket"
    rows=$((rows + 1))
}

audit_repo() {
    local repo=$1 common previous count remote remote_refs remote_ok default_branch default_ref
    local field wt head branch locked primary
    common=$(git -C "$repo" rev-parse --git-common-dir 2>/dev/null) || {
        printf 'ERROR cannot read Git directory: %s\n' "$repo" >&2
        errors=$((errors + 1)); return
    }
    common=$(cd "$repo" && cd "$common" && pwd -P) || {
        printf 'ERROR cannot access Git directory: %s\n' "$repo" >&2
        errors=$((errors + 1)); return
    }
    for previous in "${seen[@]}"; do [ "$previous" != "$common" ] || return 0; done
    seen+=("$common")
    count=$(git -C "$repo" worktree list --porcelain | grep -c '^worktree ')
    [ "$count" -gt 1 ] || return 0
    repos=$((repos + 1))
    remote=$(git -C "$repo" remote)
    if printf '%s\n' "$remote" | grep -qx origin; then remote=origin
    else remote=$(printf '%s\n' "$remote" | head -1); fi
    remote_refs=
    remote_ok=no
    default_branch=
    default_ref=
    if [ -n "$remote" ]; then
        if remote_refs=$(git -C "$repo" ls-remote --symref "$remote" HEAD 'refs/heads/*' 2>/dev/null); then
            remote_ok=yes
            default_branch=$(printf '%s\n' "$remote_refs" | awk '$1 == "ref:" && $3 == "HEAD" {sub(/^refs\/heads\//, "", $2); print $2; exit}')
            default_ref=$(printf '%s\n' "$remote_refs" | awk '$2 == "HEAD" && $1 != "ref:" {print $1; exit}')
            if [ -n "$default_ref" ] && ! git -C "$repo" cat-file -e "$default_ref^{commit}" 2>/dev/null; then default_ref=; fi
        else
            printf 'WARN remote unavailable: %s (%s); remote/unpushed may be UNKNOWN\n' "$repo" "$remote" >&2
        fi
        if [ -z "$default_branch" ]; then
            default_branch=$(git -C "$repo" symbolic-ref --quiet --short "refs/remotes/$remote/HEAD" 2>/dev/null) || default_branch=
            default_branch=${default_branch#"$remote/"}
        fi
    fi
    if [ -z "$default_branch" ]; then
        if git -C "$repo" show-ref --verify --quiet refs/heads/main; then default_branch=main
        elif git -C "$repo" show-ref --verify --quiet refs/heads/master; then default_branch=master; fi
    fi
    if [ -z "$default_ref" ] && [ -n "$default_branch" ]; then
        if git -C "$repo" show-ref --verify --quiet "refs/remotes/$remote/$default_branch"; then
            default_ref="refs/remotes/$remote/$default_branch"
        elif git -C "$repo" show-ref --verify --quiet "refs/heads/$default_branch"; then
            default_ref="refs/heads/$default_branch"
        fi
        printf 'WARN cached/local merge base: %s (%s); no fetch performed\n' "$repo" "${default_ref:-UNKNOWN}" >&2
    fi
    printf 'REPO %s default=%s merge-ref=%s\n' "$repo" "${default_branch:-UNKNOWN}" "${default_ref:-UNKNOWN}" >&2
    wt='' head='' branch='' locked=no primary=yes
    while IFS= read -r -d '' field; do
        case "$field" in
            'worktree '*) wt=${field#worktree } ;;
            'HEAD '*) head=${field#HEAD } ;;
            'branch '*) branch=${field#branch refs/heads/} ;;
            locked*) locked=yes ;;
            '')
                if [ -n "$wt" ]; then
                    worktree_row "$wt" "$head" "$branch" "$locked" "$primary"
                    primary=no
                fi
                wt='' head='' branch='' locked=no ;;
        esac
    done < <(git -C "$repo" worktree list --porcelain -z)
}

discover() {
    local dir=$1 child
    if [ -e "$dir/.git" ]; then
        if git -C "$dir" rev-parse --git-common-dir >/dev/null 2>&1; then
            audit_repo "$dir"
            return
        fi
        printf 'WARN skipped invalid .git marker: %s\n' "$dir/.git" >&2
        skipped=$((skipped + 1))
    fi
    # Worktree paths themselves come only from Git, regardless of their layout.
    for child in "$dir"/* "$dir"/.[!.]* "$dir"/..?*; do
        [ -d "$child" ] && [ ! -L "$child" ] || continue
        case "${child##*/}" in .git|node_modules|vendor|target|dist|build|.cache) continue ;; esac
        discover "$child"
    done
}

printf 'REPO\tWORKTREE\tBRANCH\tSIZE_KIB\tHEAD_AGE_DAYS\tMERGED\tDIRTY\tUNPUSHED\tREMOTE\tBUCKET\n'
discover "$(cd "$root" && pwd -P)"
printf 'SUMMARY repos_with_worktrees=%s worktrees=%s errors=%s skipped_invalid_git_markers=%s (read-only; nothing removed)\n' "$repos" "$rows" "$errors" "$skipped" >&2
[ "$errors" -eq 0 ]
