#!/usr/bin/env node
// The strain line for the day skill's reports.
//
// Public seam: strain({ platform, home, run }) -> the line, or "" when the machine is fine.
//   A line appears when the volume holding home has under 50 GB free, or memory pressure
//   is at warning or worse, and it names the biggest cause of each.
//   run(command, args) -> Promise<stdout>. The CLI runs the real commands.
//
// CLI: node strain.mjs
// Prints the line, or nothing. Exit codes: 0 read, 2 a reading failed.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);

const MIN_FREE_BYTES = 50e9;
const KIB = 1024;
// kern.memorystatus_vm_pressure_level reports 1, 2 or 4.
const DARWIN_LEVELS = { 1: "normal", 2: "warning", 4: "critical" };
// Linux has no pressure level, so the share of memory still available stands in for it.
const LINUX_WARNING_SHARE = 0.1;
const LINUX_CRITICAL_SHARE = 0.05;
const DU_TIMEOUT_MS = 5 * 60 * 1000;

export async function strain({ platform, home, run }) {
  const parts = [];
  const freeBytes = await freeDiskBytes(home, run);
  if (freeBytes < MIN_FREE_BYTES) {
    parts.push(`${gb(freeBytes)} GB free on disk, biggest ${await biggestFolder(home, run)}`);
  }
  const level = await memoryPressure(platform, run);
  if (level !== "normal") {
    parts.push(`memory pressure at ${level}, biggest ${await biggestApp(run)}`);
  }
  return parts.length ? `Strain: ${parts.join("; ")}.` : "";
}

async function freeDiskBytes(home, run) {
  const [, row] = (await run("df", ["-kP", home])).trim().split("\n");
  const available = Number(row?.trim().split(/\s+/)[3]);
  if (!Number.isFinite(available)) throw new Error(`could not read free space from df for ${home}`);
  return available * KIB;
}

async function memoryPressure(platform, run) {
  if (platform === "darwin") {
    const raw = (await run("sysctl", ["-n", "kern.memorystatus_vm_pressure_level"])).trim();
    const level = DARWIN_LEVELS[raw];
    if (!level) throw new Error(`unknown memory pressure level: ${raw}`);
    return level;
  }
  if (platform === "linux") {
    const meminfo = await run("cat", ["/proc/meminfo"]);
    const field = (name) => Number(meminfo.match(new RegExp(`^${name}:\\s+(\\d+)`, "m"))?.[1]);
    const share = field("MemAvailable") / field("MemTotal");
    if (!Number.isFinite(share)) throw new Error("could not read MemAvailable and MemTotal from /proc/meminfo");
    if (share < LINUX_CRITICAL_SHARE) return "critical";
    if (share < LINUX_WARNING_SHARE) return "warning";
    return "normal";
  }
  throw new Error(`no memory pressure reading on ${platform}`);
}

async function biggestFolder(home, run) {
  const sizes = (await run("du", ["-xkd", "2", home]))
    .trim()
    .split("\n")
    .map((line) => line.match(/^(\d+)\t(.+)$/))
    .filter(Boolean)
    .map(([, kib, folder]) => ({ bytes: Number(kib) * KIB, segments: path.relative(home, folder).split(path.sep), folder }))
    .filter(({ segments }) => segments[0] !== "");
  const top = largest(sizes.filter(({ segments }) => segments.length === 1));
  if (!top) return "folder unknown (du listed nothing)";
  const inside = largest(sizes.filter(({ segments }) => segments.length === 2 && segments[0] === top.segments[0]));
  const name = (folder) => `~/${path.relative(home, folder)}`;
  const detail = inside ? `, of which ${name(inside.folder)} ${gb(inside.bytes)} GB` : "";
  return `${name(top.folder)} (${gb(top.bytes)} GB${detail})`;
}

async function biggestApp(run) {
  const apps = new Map();
  for (const line of (await run("ps", ["-A", "-o", "rss=,comm="])).split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) continue;
    const name = appName(match[2]);
    const app = apps.get(name) ?? { name, bytes: 0, processes: 0 };
    app.bytes += Number(match[1]) * KIB;
    app.processes += 1;
    apps.set(name, app);
  }
  const top = largest([...apps.values()]);
  if (!top) return "app unknown (ps listed nothing)";
  return `${top.name} (${gb(top.bytes)} GB in ${top.processes} ${top.processes === 1 ? "process" : "processes"})`;
}

// A macOS app runs as many helper processes, so they count under the outermost .app.
function appName(command) {
  const bundle = command.split("/").find((part) => part.endsWith(".app"));
  return bundle ? bundle.slice(0, -".app".length) : path.basename(command);
}

function largest(items) {
  return items.reduce((best, item) => (!best || item.bytes > best.bytes ? item : best), undefined);
}

function gb(bytes) {
  const value = bytes / 1e9;
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

// du exits non-zero when any folder is unreadable, yet still prints every size it read.
async function runCommand(command, args) {
  try {
    const { stdout } = await execFileP(command, args, { maxBuffer: 64 * 1024 * 1024, timeout: DU_TIMEOUT_MS });
    return stdout;
  } catch (error) {
    if (command === "du" && !error.killed && error.stdout) return error.stdout;
    throw error;
  }
}

async function main() {
  try {
    const line = await strain({ platform: process.platform, home: os.homedir(), run: runCommand });
    if (line) console.log(line);
    return 0;
  } catch (error) {
    console.error(`strain: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
