#!/usr/bin/env python3
"""Exercise the artifact and cache audit CLI against a fixture HOME and code root.

Fixtures are intentionally retained: this check performs no deletions.
Run: python3 skills/cleanup/scripts/test-artifact-audit.py
"""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

SCRIPT = Path(__file__).with_name("artifact-audit.sh")
ROOT = Path(tempfile.mkdtemp(prefix="artifact-audit-check-")).resolve()
HOME = ROOT / "home"
CODE = ROOT / "code"
ENV = {**{k: v for k, v in os.environ.items() if not k.startswith("XDG_")},
       "HOME": str(HOME), "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
       "GIT_AUTHOR_NAME": "Audit check", "GIT_AUTHOR_EMAIL": "audit@example.test",
       "GIT_COMMITTER_NAME": "Audit check", "GIT_COMMITTER_EMAIL": "audit@example.test"}


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], env=ENV,
                                   stderr=subprocess.PIPE, text=True).strip()


def write(path, size=1024):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * size)


def repo(path, ignore, files):
    path.mkdir(parents=True)
    git(path, "init", "-b", "main")
    (path / ".gitignore").write_text(ignore)
    for name in files:
        write(path / name)
    git(path, "add", "-f", ".gitignore", *files)
    git(path, "commit", "-m", "test: seed artifact fixture")


for cache in [".npm/_cacache/index-v5/aa", "Library/Caches/Homebrew/downloads/pkg.tar.gz",
              "go/pkg/mod/cache/download/mod.zip", ".cargo/registry/cache/crate.crate",
              "Library/Developer/Xcode/DerivedData/App-abc/Build/app.o",
              "Library/Caches/SomeApp/cookies"]:
    write(HOME / cache)

app = CODE / "app with spaces"
repo(app, "node_modules/\n.next/\ntarget/\n", ["index.js"])
write(app / "node_modules" / "left-pad" / "index.js", 64 * 1024)
write(app / "node_modules" / "left-pad" / "node_modules" / "inner" / "index.js")
write(app / ".next" / "cache" / "page.js")
feature = CODE / "app with spaces.worktrees" / "feature"
git(app, "worktree", "add", "-b", "feature", str(feature))
write(feature / "node_modules" / "dep" / "index.js")
# A tracked target directory is source, and so is a force-added file under an ignored one.
repo(CODE / "tracked", "", ["target/keep.txt"])
repo(CODE / "forced", "target/\n", ["target/vendored.txt"])
write(CODE / "loose" / "node_modules" / "dep" / "index.js")

result = subprocess.run(["/bin/bash", str(SCRIPT), str(CODE)], env=ENV,
                        capture_output=True, text=True, check=True)


def unquote(field):
    return field if field == "-" else shlex.split(field)[0]


lines = result.stdout.splitlines()
header = lines[0].split("\t")
rows = [dict(zip(header, line.split("\t"))) for line in lines[1:]]
by_path = {unquote(row["PATH"]): row for row in rows}


def expect(path, kind, name, bucket, clean, worktree="-"):
    row = by_path.get(str(path))
    assert row, f"{path} missing from:\n{result.stdout}"
    assert (row["KIND"], row["NAME"], row["BUCKET"], row["CLEAN"]) == (kind, name, bucket, clean), row
    assert unquote(row["WORKTREE"]) == str(worktree), row
    assert int(row["SIZE_KIB"]) > 0, row
    return row


row = expect(app / "node_modules", "artifact", "node_modules", "CANDIDATE-CHECK-USAGE", "delete", app)
assert int(row["SIZE_KIB"]) >= 64, row
expect(app / ".next", "artifact", ".next", "CANDIDATE-CHECK-USAGE", "delete", app)
expect(feature / "node_modules", "artifact", "node_modules", "CANDIDATE-CHECK-USAGE", "delete", feature)
expect(CODE / "tracked" / "target", "artifact", "target", "HOLD-NOT-IGNORED", "delete", CODE / "tracked")
expect(CODE / "forced" / "target", "artifact", "target", "HOLD-NOT-IGNORED", "delete", CODE / "forced")
expect(CODE / "loose" / "node_modules", "artifact", "node_modules", "HOLD-OUTSIDE-GIT", "delete")
expect(HOME / "Library/Developer/Xcode/DerivedData", "artifact", "DerivedData", "CANDIDATE", "delete")
expect(HOME / ".npm/_cacache", "cache", "npm", "CANDIDATE", "npm cache clean --force")
expect(HOME / "Library/Caches/Homebrew", "cache", "homebrew", "CANDIDATE", "brew cleanup --prune=all")
expect(HOME / "go/pkg/mod", "cache", "go-mod", "CANDIDATE", "go clean -modcache")
expect(HOME / ".cargo/registry", "cache", "cargo", "CANDIDATE", "delete")
# Nested artifacts belong to the outer row, and other app caches are never listed.
assert not any("left-pad" in path or "SomeApp" in path for path in by_path), result.stdout
assert len(rows) == 11, result.stdout
assert "artifacts=7 caches=4" in result.stderr, result.stderr
print(f"PASS: artifacts, caches, sizes, holds; fixtures retained at {ROOT}")
