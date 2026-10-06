import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";

const ship = fileURLToPath(new URL("./ship.mjs", import.meta.url));

test("verdict check invalidates a final blank line changed to a space-only line", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ship-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  git("remote", "add", "origin", dir);
  const commit = (contents) => {
    writeFileSync(join(dir, "sample.txt"), contents);
    git("add", "sample.txt");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  commit("first\n");
  git("checkout", "--quiet", "-b", "feature");
  const blankHead = commit("first\n\n");
  const publish = (head) => {
    git("update-ref", "refs/pull/7/head", head);
    writeFileSync(join(dir, "pr.json"), JSON.stringify({ number: 7, author: { login: "author" }, baseRefName: "main", headRefName: "feature", headRefOid: head }));
  };
  publish(blankHead);
  writeFileSync(join(dir, "comments.json"), "[]");
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "pr" && args[1] === "list") {
  console.log("[" + fs.readFileSync("pr.json", "utf8") + "]");
} else if (args[0] === "pr" && args[1] === "view") {
  console.log(JSON.stringify({ comments: JSON.parse(fs.readFileSync("comments.json", "utf8")) }));
} else if (args[0] === "api" && args[1] === "user") {
  console.log("reviewer");
} else if (args[0] === "pr" && args[1] === "comment") {
  fs.writeFileSync("comments.json", JSON.stringify([{ body: args[args.indexOf("--body") + 1], author: { login: "reviewer" }, createdAt: "2026-10-05T12:00:00Z" }]));
} else {
  throw new Error("Unexpected gh call: " + args.join(" "));
}
`, { mode: 0o755 });
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, [ship, ...args, "--repo", "fixture/repo", "--json"], { cwd: dir, env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH }, encoding: "utf8" }));
  cli("verdict", "record", "7", "PASS", "--head", blankHead, "--by", "reviewer");
  assert.equal(cli("verdict", "check", "7").status, "current");
  publish(commit("first\n \n"));
  assert.equal(cli("verdict", "check", "7").status, "stale");
  // The own-PR rules key on the caller, so the caller must be the authenticated account.
  assert.throws(() => cli("verdict", "check", "7", "--me", "author"), /does not match the authenticated GitHub account/);
});

test("runs when invoked through a symlinked skills folder, as ~/.claude/skills is", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ship-link-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const linked = join(dir, "scripts");
  symlinkSync(dirname(ship), linked);
  const run = spawnSync(process.execPath, [join(linked, "ship.mjs")], { encoding: "utf8" });
  assert.equal(run.status, 2, `expected the usage error, got exit ${run.status} with no output`);
  assert.match(run.stderr, /usage: ship\.mjs/);
});
