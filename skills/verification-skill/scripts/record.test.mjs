import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const RECORD = fileURLToPath(new URL("./record.mjs", import.meta.url));

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "verification-skill-record-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const record = (path, command) => spawnSync(process.execPath, [RECORD, path, command], { encoding: "utf8", timeout: 20_000 });
const entries = (path) => readFileSync(path, "utf8").split(/^## /m).slice(1);

test("each command lands in the record with its text, exit status and output, and the caller gets its status", (t) => {
  const path = join(scratch(t), "record.md");
  const built = record(path, "printf 'built\\n'");
  const failed = record(path, "printf 'out\\n'; printf 'err\\n' >&2; exit 3");

  assert.equal(built.status, 0, built.stderr);
  assert.equal(failed.status, 3, failed.stderr);
  assert.equal(failed.stdout, "out\nerr\n");
  const [first, second, ...rest] = entries(path);
  assert.deepEqual(rest, []);
  assert.match(first, / exit 0 /);
  assert.ok(first.includes("$ printf 'built\\n'\nbuilt\n"), first);
  assert.match(second, / exit 3 /);
  assert.ok(second.includes("$ printf 'out\\n'; printf 'err\\n' >&2; exit 3\nout\nerr\n"), second);
});

test("a launch that leaves a process in the background returns when the command does, and the process keeps writing", async (t) => {
  const dir = scratch(t);
  const path = join(dir, "record.md");
  const marker = join(dir, "still-running");
  const launch = record(path, `(sleep 2; echo late; touch '${marker}') & echo started`);

  assert.equal(launch.status, 0, launch.stderr);
  const [entry] = entries(path);
  assert.ok(entry.includes("started\n"), entry);
  assert.ok(!entry.includes("\nlate\n"), entry);
  // A recorder that read the output through a pipe would wait for the background process, or kill it on its next write.
  const deadline = Date.now() + 15_000;
  while (!existsSync(marker) && Date.now() < deadline) await sleep(100);
  assert.ok(existsSync(marker), "the background process stopped before it finished");
});

test("a command a signal stops, such as on a harness timeout, is still recorded with the output it had", async (t) => {
  const path = join(scratch(t), "record.md");
  const child = spawn(process.execPath, [RECORD, path, "echo begun; exec sleep 30"]);
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const closed = new Promise((resolve) => child.on("close", (code) => resolve(code)));
  t.after(() => child.kill("SIGKILL"));
  const deadline = Date.now() + 15_000;
  while (!stdout.includes("begun") && child.exitCode === null && Date.now() < deadline) await sleep(50);
  assert.ok(stdout.includes("begun"), `the output didn't reach stdout while the command ran: ${JSON.stringify(stdout)}`);
  child.kill("SIGTERM");

  assert.equal(await closed, 143);
  const [entry] = entries(path);
  assert.match(entry, / stopped by SIGTERM /);
  assert.ok(entry.includes("$ echo begun; exec sleep 30\nbegun\n"), entry);
});
