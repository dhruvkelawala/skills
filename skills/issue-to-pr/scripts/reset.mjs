#!/usr/bin/env node
// The build thread's reset of its own context after stage 5. Before the reset, the thread saves
// what the fresh context must find unchanged; the fresh context checks it before stage 6.
//
//   reset.mjs before <record>   save the snapshot in the record's `reset:` header line
//   reset.mjs after <record>    compare the record with the snapshot; writes nothing
//
// The snapshot holds the fields a reset must not move: stage, repairs, draft, guide and land, with
// an absent line kept as absent. `before` refuses a record that already has one, so a fresh context
// never resets the run again. `after` exits 0 when every field matches, 1 naming each one that
// moved, and 2 without a snapshot. It also reports the fresh session's first request against the
// 100k limit, which never changes its exit.

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { currentSession } from "./observe.mjs";
import { header, setHeader } from "./run-record.mjs";

const USAGE = "usage: reset.mjs before <record> | after <record>";
const FIELDS = ["stage", "repairs", "draft", "guide", "land"];
const LIMIT = 100000;

const snapshotOf = (record) => Object.fromEntries(FIELDS.map((key) => [key, header(record, key) || null]));
const describe = (fields) => FIELDS.map((key) => `${key} ${fields[key] ?? "none"}`).join(", ");

function before(path) {
  const record = readFileSync(path, "utf8");
  const saved = header(record, "reset");
  if (saved) {
    console.log(`already reset: ${saved}. The fresh context resumes as resume.md says and never resets again.`);
    return 1;
  }
  const fields = snapshotOf(record);
  writeFileSync(path, setHeader(record, "reset", JSON.stringify({ at: new Date().toISOString(), ...fields })));
  console.log(`reset snapshot saved: ${describe(fields)}`);
  return 0;
}

async function after(path) {
  const record = readFileSync(path, "utf8");
  let saved;
  try { saved = JSON.parse(header(record, "reset")); } catch {}
  if (!saved) {
    console.error(`reset: no reset snapshot in ${path}; run reset.mjs before first`);
    return 2;
  }
  const now = snapshotOf(record);
  const moved = FIELDS.filter((key) => (saved[key] ?? null) !== now[key]);
  if (moved.length) {
    for (const key of moved) console.log(`${key}: ${saved[key] ?? "none"} before the reset, ${now[key] ?? "none"} now`);
  } else {
    console.log(`record unchanged across the reset: ${describe(now)}`);
  }
  console.log(`first request after the reset: ${await firstRequest()}`);
  return moved.length ? 1 : 0;
}

// The first request's input in the fresh session's own transcript: uncached input plus cache reads
// and writes. Any failure reports unavailable.
async function firstRequest() {
  try {
    const session = await currentSession();
    if (session?.runtime !== "claude") return "unavailable";
    for (const line of (await readFile(session.transcript_path, "utf8")).split("\n")) {
      if (!line.includes('"assistant"')) continue;
      const entry = JSON.parse(line);
      const usage = entry.type === "assistant" && entry.message?.usage;
      if (!usage) continue;
      const total = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"].reduce((sum, key) => sum + (usage[key] ?? 0), 0);
      return `${total} input tokens, ${total <= LIMIT ? "within" : "over"} the ${LIMIT} limit`;
    }
  } catch {}
  return "unavailable";
}

async function main([command, path, ...rest]) {
  if (!path || rest.length || !["before", "after"].includes(command)) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`reset: no run record at ${path}`);
    return 2;
  }
  return command === "before" ? before(path) : after(path);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
