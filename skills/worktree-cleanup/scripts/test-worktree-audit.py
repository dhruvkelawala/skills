#!/usr/bin/env python3
"""Exercise the audit CLI and prove it leaves fixture content unchanged.

Fixtures are intentionally retained: this check performs no deletions.
Run: python3 skills/worktree-cleanup/scripts/test-worktree-audit.py
"""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile

SCRIPT = Path(__file__).with_name("worktree-audit.sh")
ROOT = Path(tempfile.mkdtemp(prefix="worktree-audit-check-"))
ENV = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
       "GIT_AUTHOR_NAME": "Audit check", "GIT_AUTHOR_EMAIL": "audit@example.test",
       "GIT_COMMITTER_NAME": "Audit check", "GIT_COMMITTER_EMAIL": "audit@example.test"}


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], env=ENV,
                                   stderr=subprocess.PIPE, text=True).strip()


def snapshot():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in ROOT.rglob("*") if p.is_file()}


repo = ROOT / "repo with spaces"
repo.mkdir()
git(repo, "init", "-b", "trunk")
(repo / "tracked.txt").write_text("seed\n")
(repo / ".gitignore").write_text("ignored/\n")
git(repo, "add", ".")
git(repo, "commit", "-m", "test: seed audit fixture")
remote = ROOT / "remote.git"
git(ROOT, "init", "--bare", "-b", "trunk", str(remote))
git(repo, "remote", "add", "origin", str(remote))
git(repo, "push", "-u", "origin", "trunk")
git(repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk")

paths = {}
for branch in ["sumo/merged", "dirty", "unpushed", "gone", "ignored", "locked"]:
    path = ROOT / "repo with spaces.sumo-worktrees" / branch.replace("/", "__")
    if branch == "sumo/merged":
        path = path.with_name(path.name + "\ttab\nnewline")
    git(repo, "worktree", "add", "-b", branch, str(path), "trunk")
    paths[branch] = path
    if branch != "gone":
        git(repo, "push", "origin", branch)

# Model a previously observed branch now absent from the live remote.
git(repo, "update-ref", "refs/remotes/origin/gone", git(repo, "rev-parse", "HEAD"))
(paths["dirty"] / "tracked.txt").write_text("uncommitted\n")
(paths["dirty"] / "untracked.txt").write_text("keep me\n")
(paths["unpushed"] / "tracked.txt").write_text("local commit\n")
git(paths["unpushed"], "add", "tracked.txt")
git(paths["unpushed"], "commit", "-m", "test: add unpublished fixture commit")
(paths["ignored"] / "ignored").mkdir()
(paths["ignored"] / "ignored" / "artifact").write_text("keep artifact\n")
git(repo, "worktree", "lock", str(paths["locked"]))
detached = ROOT / "worktrees" / "detached checkout"
git(repo, "worktree", "add", "--detach", str(detached), "trunk")

invalid_marker = ROOT / "cache" / ".git"
invalid_marker.parent.mkdir()
invalid_marker.write_text("")

before = snapshot()
result = subprocess.run(["/bin/bash", str(SCRIPT), str(ROOT)], env=ENV,
                        capture_output=True, text=True, check=True)
assert before == snapshot(), "Audit wrote to the fixture"
lines = result.stdout.splitlines()
header = lines[0].split("\t")
rows = [dict(zip(header, line.split("\t"))) for line in lines[1:]]
by_branch = {row["BRANCH"]: row for row in rows}
assert len(rows) == 8, result.stdout
assert "repos_with_worktrees=1 worktrees=8 errors=0 skipped_invalid_git_markers=1" in result.stderr, result.stderr
assert "WARN skipped invalid .git marker:" in result.stderr, result.stderr
assert "default=trunk" in result.stderr, result.stderr
assert by_branch["trunk"]["BUCKET"] == "PRIMARY"
assert "\\t" in by_branch["sumo/merged"]["WORKTREE"] and "\\n" in by_branch["sumo/merged"]["WORKTREE"]
assert by_branch["sumo/merged"]["MERGED"] == "YES"
assert by_branch["sumo/merged"]["UNPUSHED"] == "0"
assert by_branch["sumo/merged"]["BUCKET"] == "CANDIDATE-CHECK-USAGE"
assert by_branch["dirty"]["DIRTY"] == "tracked:1,untracked:1,ignored:0"
assert by_branch["dirty"]["BUCKET"] == "HOLD-DIRTY"
assert by_branch["unpushed"]["MERGED"] == "NO"
assert by_branch["unpushed"]["UNPUSHED"] == "1"
assert by_branch["unpushed"]["BUCKET"] == "HOLD-UNPUSHED-OR-UNKNOWN"
assert by_branch["gone"]["REMOTE"] == "absent-previously-tracked"
assert by_branch["gone"]["BUCKET"] == "HOLD-UNPUSHED-OR-UNKNOWN"
assert by_branch["ignored"]["DIRTY"] == "tracked:0,untracked:0,ignored:1"
assert by_branch["locked"]["BUCKET"] == "HOLD-LOCKED"
assert by_branch["DETACHED"]["REMOTE"] == "detached"
assert by_branch["DETACHED"]["BUCKET"] == "HOLD-UNPUSHED-OR-UNKNOWN"
assert all(int(row["SIZE_KIB"]) > 0 and int(row["HEAD_AGE_DAYS"]) >= 0 for row in rows)
# HEAD lets callers match a worktree to a merged PR's head commit.
assert by_branch["unpushed"]["HEAD"] == git(paths["unpushed"], "rev-parse", "HEAD")
assert by_branch["sumo/merged"]["HEAD"] == git(repo, "rev-parse", "trunk")

# A repo-root invocation still lists sibling trees; invalid paths fail clearly.
subprocess.run(["bash", str(SCRIPT), str(repo)], env=ENV, check=True, capture_output=True)
assert before == snapshot(), "Repo-root audit wrote to the fixture"
assert subprocess.run(["bash", str(SCRIPT), str(ROOT / "missing")],
                      env=ENV, capture_output=True).returncode == 1
# Failed remote reads remain unknown, even when cached refs look pushed.
git(repo, "remote", "set-url", "origin", str(ROOT / "unavailable-remote"))
before_offline = snapshot()
offline = subprocess.run(["bash", str(SCRIPT), str(repo)], env=ENV,
                         capture_output=True, text=True, check=True)
assert before_offline == snapshot(), "Offline audit wrote to the fixture"
assert "WARN remote unavailable:" in offline.stderr
assert "WARN cached/local merge base:" in offline.stderr
assert "\tUNKNOWN\tUNKNOWN\tHOLD-UNPUSHED-OR-UNKNOWN" in offline.stdout
print(f"PASS: 8 classifications, HEAD SHAs, offline safety, invalid markers, deduplication, whitespace paths, trunk, read-only; fixtures retained at {ROOT}")
