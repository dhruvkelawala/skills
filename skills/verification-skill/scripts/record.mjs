#!/usr/bin/env node
// The record create keeps from its first command. Every command runs through this script, which prints
// what the command printed, stdout and stderr together in the order they came, and appends one entry to
// the record: when it started, its exit status, how long it took, the load average and core count, the
// folder it ran in, the command and its output.
//
//   record.mjs <record> '<command>'
//
// The command runs with bash -c, and the script exits with its status, or 128 plus the signal number
// when a signal stopped it. A command stopped by a signal sent to this script, such as on a harness
// timeout, is still recorded with the output it had. A bad argument exits 2.

import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readSync, realpathSync, rmSync } from "node:fs";
import { constants, cpus, loadavg, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: record.mjs <record> '<command>'";
const STOPS = ["SIGINT", "SIGTERM", "SIGHUP"];

function record(path, command) {
  const started = new Date();
  const dir = mkdtempSync(join(tmpdir(), "verification-skill-record-"));
  const file = join(dir, "output");
  const out = openSync(file, "w");
  const child = spawn("bash", ["-c", command], { stdio: ["inherit", out, out] });
  closeSync(out);

  const input = openSync(file, "r");
  const chunks = [];
  const buffer = Buffer.alloc(1 << 16);
  const pump = () => {
    for (let n; (n = readSync(input, buffer)) > 0; ) {
      const chunk = Buffer.from(buffer.subarray(0, n));
      chunks.push(chunk);
      process.stdout.write(chunk);
    }
  };
  const timer = setInterval(pump, 100);

  return new Promise((done) => {
    let finished = false;
    const finish = (status, code) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      pump();
      closeSync(input);
      rmSync(dir, { recursive: true, force: true });
      const output = Buffer.concat(chunks).toString("utf8");
      appendFileSync(path, entry({ started, status, command, output }));
      done(code);
    };
    child.on("exit", (code, signal) => (signal ? finish(`stopped by ${signal}`, 128 + constants.signals[signal]) : finish(`exit ${code}`, code)));
    child.on("error", (error) => finish(`could not start: ${error.message}`, 127));
    for (const signal of STOPS) {
      process.on(signal, () => {
        child.kill(signal);
        child.unref();
        finish(`stopped by ${signal}`, 128 + constants.signals[signal]);
      });
    }
  });
}

function entry({ started, status, command, output }) {
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const load = `load ${loadavg()[0].toFixed(2)} on ${cpus().length} cores`;
  const text = output && !output.endsWith("\n") ? `${output}\n` : output;
  const longest = Math.max(2, ...[...`${command}\n${text}`.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = "`".repeat(longest + 1);
  const stamp = started.toISOString().replace(/\.\d+Z$/, "Z");
  return `\n## ${stamp} · ${status} · ${seconds} s · ${load}\n\nIn ${process.cwd()}:\n\n${fence}console\n$ ${command}\n${text}${fence}\n`;
}

async function main(argv) {
  const [path, command, ...rest] = argv;
  if (!path || !command?.trim() || rest.length) {
    console.error(USAGE);
    return 2;
  }
  mkdirSync(dirname(resolve(path)), { recursive: true });
  process.stdout.on("error", () => {});
  return record(resolve(path), command);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
