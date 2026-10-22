// Stands in for the autoreview helper during the eval. It prints the fixed second-opinion report in the
// helper's own format and logs its flags, the commit it ran at and the base it resolved to $FAKE_DIR/autoreview.jsonl.
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { findingsFor } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(name) + 1];
const rev = (ref) => {
  try {
    return execFileSync("git", ["rev-parse", `${ref}^{commit}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const head = rev("HEAD");
const base = args.includes("--base") ? rev(flag("--base")) : null;
const findings = findingsFor("autoreview", JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).phase);
process.stdout.write(
  [
    `autoreview target: ${args.includes("--mode") ? flag("--mode") : "auto"}`,
    `engine: ${args.includes("--engine") ? flag("--engine") : "codex"}`,
    `ref: ${base}`,
    `autoreview findings: ${findings.length}`,
    ...findings.map((f) => `[${f.priority}] ${f.title}\n${f.file}:${f.line}\n${f.body}\n`),
    `overall: patch is ${findings.length ? "incorrect" : "correct"} (0.90)`,
    "",
  ].join("\n"),
);
appendFileSync(join(dir, "autoreview.jsonl"), `${JSON.stringify({ at: Date.now(), args, cwd: process.cwd(), head, base })}\n`);
process.exit(findings.length ? 1 : 0);
