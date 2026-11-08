#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 6 ]; then
	printf 'usage: log.sh <logfile> <phase> <decision> <why> <evidence> <result>\n' >&2
	exit 1
fi

logfile="$1"
shift

logdir="$(dirname "$logfile")"
if [ -n "$logdir" ] && [ "$logdir" != "." ] && [ ! -d "$logdir" ]; then
	mkdir -p "$logdir"
fi

header=$'ts\tphase\tdecision\twhy\tevidence\tresult'
if [ -s "$logfile" ]; then
	first=''
	if ! IFS= read -r first < "$logfile" || [ "$first" != "$header" ]; then
		printf 'not a decision log: %s\n' "$logfile" >&2
		exit 1
	fi
else
	printf '%s\n' "$header" >> "$logfile"
fi

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
clean() {
	local v start
	v=$(printf '%s' "$1" | tr '\t\n\r' '   ')
	# Spreadsheet readers may ignore whitespace before a formula marker.
	start="${v#"${v%%[![:space:]]*}"}"
	case "$start" in
		=*|+*|-*|@*) printf "'%s" "$v" ;;
		*) printf '%s' "$v" ;;
	esac
}
printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
	"$ts" "$(clean "$1")" "$(clean "$2")" "$(clean "$3")" "$(clean "$4")" "$(clean "$5")" \
	>> "$logfile"
