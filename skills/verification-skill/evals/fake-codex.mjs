import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { probeDevices } from "./fake-device-probe.mjs";

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
assert.equal(args[0], "exec");
assert.ok(args.includes("--json"));
assert.ok(args.includes("--dangerously-bypass-approvals-and-sandbox"));
const phase = args.includes("--output-schema") ? "grade" : "create";
const home = process.env.CODEX_HOME;
const files = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => relative(dir, join(e.parentPath, e.name)));
const git = (...a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();
const seen = {
  devices: probeDevices(),
  phase, home, linkedAuth: lstatSync(join(home, "auth.json")).isSymbolicLink(),
  skills: files(join(home, "skills")), model: option("--model"), effort: option("-c"), cwd: process.cwd(),
  gh: spawnSync("gh", ["pr", "list"]).status,
  push: spawnSync("git", ["push", process.env.FAKE_CASE_REPO, "HEAD:refs/heads/pushed"]).status,
  head: git("rev-parse", "HEAD"),
};
const emit = (event) => console.log(JSON.stringify(event));
emit({ type: "thread.started", thread_id: "fake-thread" });
emit({ type: "turn.started" });
if (phase === "create") {
  const stray = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { cwd: tmpdir(), detached: true, stdio: "ignore" });
  stray.unref();
  seen.strays = [stray.pid];
  mkdirSync(".agents/skills/verify-demo", { recursive: true });
  writeFileSync(".agents/skills/verify-demo/SKILL.md", "---\nname: verify-demo\n---\n\n# Verify demo\n");
  mkdirSync(".claude/skills", { recursive: true });
  symlinkSync("../../.agents/skills/verify-demo", ".claude/skills/verify-demo");
  if (process.env.FAKE_CREATE === "fails") {
    spawnSync("xcrun", ["simctl", "boot", "DEMO-UDID"]);
    appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(seen)}\n`);
    emit({ type: "item.completed", item: { type: "command_execution", command: "xcrun simctl boot DEMO-UDID", aggregated_output: "", exit_code: 0 } });
    process.stdout.write('{"type":"item.');
    process.exit(1);
  }
  emit({ type: "item.completed", item: { type: "agent_message", text: "Created verify-demo" } });
} else {
  const schema = JSON.parse(readFileSync(option("--output-schema"), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.lessons.items.required, ["lesson", "verdict", "file", "quote", "why"]);
  const step = { result: "passed", note: "" };
  const previous = readFileSync(process.env.FAKE_CLAUDE_LOG, "utf8").trim().split("\n").map(JSON.parse);
  const verdicts = previous.some((a) => a.phase === "grade") ? "covered,covered,missing" : process.env.FAKE_VERDICTS;
  const grade = {
    lessons: verdicts.split(",").map((verdict, i) => ({ lesson: i + 1, verdict, file: "", quote: "", why: "" })),
    replay: { launch: step, doctor: step, drive: step, cleanup: step },
  };
  writeFileSync(option("--output-last-message"), process.env.FAKE_CREATE === "bad-grade" ? "not JSON" : JSON.stringify(grade));
  emit({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(grade) } });
}
appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(seen)}\n`);
emit({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } });
