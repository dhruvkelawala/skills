// Stands in for the claude CLI in run.test.mjs. The create agent logs what it can see, writes a verify skill and
// leaves two processes running: one that keeps the run's environment, and one started with an empty environment from
// inside the checkout. With FAKE_CREATE=fails it also boots a simulator, then dies halfway through a line of its
// transcript. The grader, called with --json-schema, returns the verdicts in FAKE_VERDICTS.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const emit = (event) => console.log(JSON.stringify(event));
const git = (...args) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const files = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => relative(dir, join(e.parentPath, e.name)));
const log = (entry) => appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(entry)}\n`);
const idle = ["-e", "setInterval(() => {}, 1000)"];

emit({ type: "system", subtype: "init", model: "fake-model" });

if (process.argv.includes("--json-schema")) {
  const verdicts = process.env.FAKE_VERDICTS.split(",");
  const step = (result) => ({ result, note: "" });
  emit({
    type: "result",
    is_error: false,
    result: "graded",
    structured_output: {
      lessons: verdicts.map((verdict, i) => ({ lesson: i + 1, verdict, file: ".agents/skills/verify-demo/SKILL.md", quote: "", why: "" })),
      replay: { launch: step("passed"), doctor: step("passed"), drive: step("failed"), cleanup: step("passed") },
    },
  });
} else {
  const stray = spawn(process.execPath, idle, { cwd: tmpdir(), detached: true, stdio: "ignore" });
  const bare = spawn("/usr/bin/env", ["-i", process.execPath, ...idle], { cwd: process.cwd(), detached: true, stdio: "ignore" });
  stray.unref();
  bare.unref();
  log({
    cwd: process.cwd(),
    head: git("rev-parse", "HEAD"),
    commits: git("log", "--all", "--format=%H").split("\n"),
    remotes: git("remote"),
    skills: files(join(process.env.CLAUDE_CONFIG_DIR, "skills")),
    gh: spawnSync("gh", ["pr", "list"]).status,
    push: spawnSync("git", ["push", process.env.FAKE_CASE_REPO, "HEAD:refs/heads/pushed"]).status,
    strays: [stray.pid, bare.pid],
  });
  mkdirSync(".agents/skills/verify-demo", { recursive: true });
  writeFileSync(".agents/skills/verify-demo/SKILL.md", "---\nname: verify-demo\n---\n\n# Verify demo\n");
  emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "node -e 'setInterval(() => {}, 1000)' &" } }] } });
  if (process.env.FAKE_CREATE === "fails") {
    spawnSync("xcrun", ["simctl", "boot", "DEMO-UDID"]);
    emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "t2", name: "Bash", input: { command: "xcrun simctl boot DEMO-UDID" } }] } });
    process.stdout.write('{"type":"assistant","message":{"content":[{"type":"te');
    process.exit(1);
  }
  emit({ type: "result", is_error: false, result: "Wrote .agents/skills/verify-demo." });
}
