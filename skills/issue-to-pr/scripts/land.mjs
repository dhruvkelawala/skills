#!/usr/bin/env node
// A "land" said before the PR is clean, held in the run record until it is. It is tied to the PR's
// head the user saw through that head's patch, fingerprinted the way ship fingerprints approvals and
// verdicts, so a restack that keeps the patch keeps the land and any other change to the patch drops it.
//
//   land.mjs hold <record> --head <sha>   hold a "land" said while the PR's head was <sha>
//   land.mjs hold <record> --merge        hold the "land" --merge gave at the build's start
//   land.mjs check <record>               at a clean HEAD: exit 0 to land, 1 when nothing is held or the land was dropped
//
// A commit's patch runs from its merge-base with the record's `base_ref`, fetched first, to the
// commit. The record's `land:` header line keeps the request: `held at <sha>, patch <fingerprint>`,
// `--merge`, or `dropped at <sha>: <why>`. A failed read exits 2.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FINGERPRINT_DIFF_FLAGS, patchFingerprint } from "../../ship/scripts/ship.mjs";
import { header, setHeader } from "./run-record.mjs";

const USAGE = ["usage: land.mjs hold <record> --head <the PR's head> | --merge", "       land.mjs check <record>"].join("\n");
const HELD = /^held at ([0-9a-f]{40}), patch ([0-9a-f]{64})$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
const short = (sha) => sha.slice(0, 7);

function hold(path, { merge, head: seen }) {
  const record = readFileSync(path, "utf8");
  if (merge) {
    writeFileSync(path, setHeader(record, "land", "--merge"));
    console.log(`"land" held from the build's start (--merge): the PR lands once it is clean`);
    return 0;
  }
  const { head, patch } = patchAt(record, seen);
  writeFileSync(path, setHeader(record, "land", `held at ${head}, patch ${patch}`));
  console.log(`"land" held at ${short(head)}: the PR lands once it is clean with this patch`);
  return 0;
}

function check(path) {
  const record = readFileSync(path, "utf8");
  const held = header(record, "land");
  if (held === "--merge") {
    console.log("land: --merge was given at the build's start");
    return 0;
  }
  const [, at, patch] = held.match(HELD) ?? [];
  if (!at) {
    console.log(held ? `no "land" is held; the last one was ${held}` : `no "land" is held`);
    return 1;
  }
  const now = patchAt(record, "HEAD");
  if (now.patch === patch) {
    console.log(`land: ${short(now.head)} has the patch "land" was said on at ${short(at)}`);
    return 0;
  }
  writeFileSync(path, setHeader(record, "land", `dropped at ${now.head}: the patch changed since "land" was said at ${at}`));
  console.log(`"land" dropped: ${short(now.head)} changes the patch "land" was said on at ${short(at)}, so the PR waits for "land" again`);
  return 1;
}

function patchAt(record, commit) {
  const base = header(record, "base_ref");
  const [, remote, branch] = base.match(/^refs\/remotes\/([^/]+)\/(.+)$/) ?? [];
  if (!branch) throw new Error(`the run record's base_ref is ${base || "missing"}, not refs/remotes/<remote>/<branch>`);
  git("fetch", "--quiet", "--no-tags", remote, `+refs/heads/${branch}:${base}`);
  const head = git("rev-parse", "--verify", `${commit}^{commit}`).trim();
  const from = git("merge-base", base, head).trim();
  return { head, patch: patchFingerprint(git("-c", "diff.relative=false", "diff", ...FINGERPRINT_DIFF_FLAGS, from, head)) };
}

function main(argv) {
  const [command, path, ...flags] = argv;
  const merge = flags.length === 1 && flags[0] === "--merge";
  const head = flags.length === 2 && flags[0] === "--head" && /^[0-9a-f]{7,40}$/i.test(flags[1]) ? flags[1] : null;
  if (!path || !(command === "check" ? flags.length === 0 : command === "hold" && (merge || head))) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`land: no run record at ${path}`);
    return 2;
  }
  try {
    return command === "hold" ? hold(path, { merge, head }) : check(path);
  } catch (error) {
    console.error(`land: ${String(error?.stderr || error?.message).trim()}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
