#!/usr/bin/env node
// A "land" said before the PR is clean, held in the run record until it is. It is tied to the head
// it was said at through that head's patch, fingerprinted the way ship fingerprints approvals and
// verdicts, so a restack that keeps the patch keeps the land and any other change to the patch drops it.
//
//   land.mjs hold <record> [--merge]   hold a "land" said at HEAD, or with --merge, the one given at the build's start
//   land.mjs check <record>            at a clean HEAD: exit 0 to land, 1 when nothing is held or the land was dropped
//
// The patch runs from HEAD's merge-base with the record's `base_ref`, fetched first, to HEAD. The
// record's `land:` header line keeps the request: `held at <sha>, patch <fingerprint>`, `--merge`, or
// `dropped at <sha>: <why>`. A failed read exits 2.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FINGERPRINT_DIFF_FLAGS, patchFingerprint } from "../../ship/scripts/ship.mjs";

const USAGE = ["usage: land.mjs hold <record> [--merge]", "       land.mjs check <record>"].join("\n");
const HELD = /^held at ([0-9a-f]{40}), patch ([0-9a-f]{64})$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
const short = (sha) => sha.slice(0, 7);

function hold(path, merge) {
  const record = readFileSync(path, "utf8");
  if (merge) {
    writeFileSync(path, setHeader(record, "land", "--merge"));
    console.log(`"land" held from the build's start (--merge): the PR lands once it is clean`);
    return 0;
  }
  const { head, patch } = patchAtHead(record);
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
  const now = patchAtHead(record);
  if (now.patch === patch) {
    console.log(`land: ${short(now.head)} has the patch "land" was said on at ${short(at)}`);
    return 0;
  }
  writeFileSync(path, setHeader(record, "land", `dropped at ${now.head}: the patch changed since "land" was said at ${at}`));
  console.log(`"land" dropped: ${short(now.head)} changes the patch "land" was said on at ${short(at)}, so the PR waits for "land" again`);
  return 1;
}

function patchAtHead(record) {
  const base = header(record, "base_ref");
  const [, remote, branch] = base.match(/^refs\/remotes\/([^/]+)\/(.+)$/) ?? [];
  if (!branch) throw new Error(`the run record's base_ref is ${base || "missing"}, not refs/remotes/<remote>/<branch>`);
  git("fetch", "--quiet", "--no-tags", remote, `+refs/heads/${branch}:${base}`);
  const head = git("rev-parse", "HEAD").trim();
  const from = git("merge-base", base, head).trim();
  return { head, patch: patchFingerprint(git("-c", "diff.relative=false", "diff", ...FINGERPRINT_DIFF_FLAGS, from, head)) };
}

// The header is the record's lines before its first blank line, rewritten in place.
const headerOf = (record) => record.split("\n\n")[0];
const header = (record, key) => headerOf(record).match(new RegExp(`^${key}: (.+)$`, "m"))?.[1].trim() ?? "";

function setHeader(record, key, value) {
  const top = headerOf(record);
  const line = new RegExp(`^${key}: .*$`, "m");
  const updated = line.test(top) ? top.replace(line, () => `${key}: ${value}`) : `${top.replace(/\n$/, "")}\n${key}: ${value}`;
  return updated + record.slice(top.length);
}

function main(argv) {
  const [command, path, ...flags] = argv;
  const merge = flags.includes("--merge");
  if (!["hold", "check"].includes(command) || !path || flags.some((flag) => flag !== "--merge") || (merge && command !== "hold")) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`land: no run record at ${path}`);
    return 2;
  }
  try {
    return command === "hold" ? hold(path, merge) : check(path);
  } catch (error) {
    console.error(`land: ${String(error?.stderr || error?.message).trim()}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
