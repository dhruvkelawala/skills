#!/usr/bin/env node
// Identify the Hunk session this workflow launched, without jq or temp files.
//
//   node find-session.mjs snapshot                     -> JSON of current session ids to stdout
//   node find-session.mjs list --repo <root>           -> bounded TSV projection of sessions for the repo
//   node find-session.mjs identify --repo <root> --pane <herdr-pane-id> --before <snapshot-file>
//                        [--retries N] [--delay-ms N]  -> the single new session id, or exit 1
//
// identify requires both proofs: the session is absent from the snapshot AND its
// PID is a foreground process of the given Herdr pane. Exactly one match wins.
// Reads state through `hunk` and `herdr` via execFile only; never mutates anything.

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import process from "node:process";

const execFileP = promisify(execFile);
const MAX_ROWS = 50;

async function run(cmd, args) {
  const { stdout } = await execFileP(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

export const defaultRunners = {
  sessions: () => run("hunk", ["session", "list", "--json"]),
  panePids: async (paneId) => {
    const data = await run("herdr", ["pane", "process-info", "--pane", paneId]);
    return (data?.result?.process_info?.foreground_processes ?? []).map((p) => Number(p.pid));
  },
};

export function sessionIds(listing) {
  return (listing?.sessions ?? []).map((s) => String(s.sessionId));
}

export function projectSessions(listing, repoRoot) {
  return (listing?.sessions ?? [])
    .filter((s) => s.repoRoot === repoRoot)
    .slice(0, MAX_ROWS)
    .map((s) => [s.sessionId, s.repoRoot, s.title ?? "", String(s.pid ?? ""), String(s.fileCount ?? "")].join("\t"));
}

export function pickNewSession(listing, { repoRoot, knownIds, panePids }) {
  const known = new Set(knownIds.map(String));
  const pids = new Set(panePids.map(Number));
  return (listing?.sessions ?? [])
    .filter((s) => s.repoRoot === repoRoot)
    .filter((s) => !known.has(String(s.sessionId)))
    .filter((s) => pids.has(Number(s.pid)))
    .map((s) => String(s.sessionId));
}

export async function identify({ repoRoot, paneId, knownIds, retries = 10, delayMs = 500, runners = defaultRunners, wait }) {
  const sleep = wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let last = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    const [listing, panePids] = await Promise.all([runners.sessions(), runners.panePids(paneId)]);
    last = pickNewSession(listing, { repoRoot, knownIds, panePids });
    if (last.length === 1) return { ok: true, sessionId: last[0] };
    if (last.length > 1) return { ok: false, reason: `ambiguous: ${last.length} new sessions in pane ${paneId}` };
    if (attempt < retries) await sleep(delayMs);
  }
  return { ok: false, reason: `no new Hunk session for ${repoRoot} in pane ${paneId} after ${retries + 1} checks` };
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const out = { command, retries: 10, delayMs: 500 };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const v = () => {
      const x = rest[++i];
      if (x === undefined) throw new Error(`${a} requires a value`);
      return x;
    };
    switch (a) {
      case "--repo": out.repoRoot = v(); break;
      case "--pane": out.paneId = v(); break;
      case "--before": out.before = v(); break;
      case "--retries": out.retries = Number(v()); break;
      case "--delay-ms": out.delayMs = Number(v()); break;
      default: throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

function usage() {
  return [
    "usage: find-session.mjs snapshot",
    "       find-session.mjs list --repo <root>",
    "       find-session.mjs identify --repo <root> --pane <herdr-pane-id> --before <snapshot-file> [--retries N] [--delay-ms N]",
  ].join("\n");
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`${usage()}\n\nerror: ${e.message}`);
    return 2;
  }
  switch (args.command) {
    case "snapshot": {
      console.log(JSON.stringify({ sessionIds: sessionIds(await defaultRunners.sessions()) }));
      return 0;
    }
    case "list": {
      if (!args.repoRoot) { console.error(usage()); return 2; }
      for (const row of projectSessions(await defaultRunners.sessions(), args.repoRoot)) console.log(row);
      return 0;
    }
    case "identify": {
      if (!args.repoRoot || !args.paneId || !args.before) { console.error(usage()); return 2; }
      let knownIds;
      try {
        knownIds = JSON.parse(readFileSync(args.before, "utf8")).sessionIds ?? [];
      } catch {
        console.error(`error: cannot read snapshot ${args.before}`);
        return 2;
      }
      const result = await identify({ repoRoot: args.repoRoot, paneId: args.paneId, knownIds, retries: args.retries, delayMs: args.delayMs });
      if (!result.ok) { console.error(`error: ${result.reason}`); return 1; }
      console.log(result.sessionId);
      return 0;
    }
    default:
      console.error(usage());
      return 2;
  }
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
