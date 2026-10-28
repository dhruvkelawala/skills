#!/usr/bin/env node
// Replays `/verification-skill create` on a case repo at the commit before its verify skill existed, has a second
// agent score what it wrote against the lessons the repo's own history taught, and appends the score to results.md.
//
//   node skills/verification-skill/evals/run.mjs           list the cases
//   node skills/verification-skill/evals/run.mjs <case>    run one case end to end
//
// README.md says what a run does and what it needs.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, loadavg, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { installDeviceGuard } from "./device-guard.mjs";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(evalsDir);
const skillsDir = dirname(skillDir);
const casesDir = join(evalsDir, "cases");
const resultsFile = join(evalsDir, "results.md");
const runsDir = join(homedir(), ".cache", "verification-skill-evals");
const USAGE = "usage: node skills/verification-skill/evals/run.mjs [<case>] [--agent codex|claude] [--runs <n>] [--skill-ref <commit>] [--wait-for-idle]";
// A short SHA with at least one digit, or a PR number, inside parentheses.
const CITATION = /\([^)]*(?:\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b|#\d+)[^)]*\)/;
// Every process an agent starts inherits this variable, so the sweep can find it after the agent exits.
const MARKER = "VERIFICATION_SKILL_EVAL_RUN";
// Caps against a hung agent, well above an iOS build plus the agent's own retries.
const MINUTES = { create: 180, grade: 90 };
const POINTS = { covered: 1, partly: 0.5, missing: 0 };
const REPLAY = ["launch", "doctor", "drive", "cleanup"];
const UNATTENDED = "Nobody can answer questions during this run. Use simulators only. Never install on, launch on, or modify a physical device or its data. Keep the eval wrappers first on PATH; never bypass them with absolute tool paths. Use non-login shells so startup files do not replace PATH.";
const GH_OFF = '#!/bin/sh\necho "gh is off in this eval, so nothing reaches the case repo on GitHub" >&2\nexit 1\n';
// An empty pushInsteadOf prefix matches every URL, so git rewrites each push, to GitHub or to the case repo on disk,
// into a path that can't exist. Fetches are untouched. It goes after any git config the caller passes the same way.
function noPush(env) {
  const n = Number(env.GIT_CONFIG_COUNT) || 0;
  return { GIT_CONFIG_COUNT: String(n + 1), [`GIT_CONFIG_KEY_${n}`]: "url./dev/null/pushes-are-off-in-this-eval/.pushInsteadOf", [`GIT_CONFIG_VALUE_${n}`]: "" };
}
// Set by an enclosing Claude Code session in what it spawns (https://code.claude.com/docs/en/env-vars), plus the SDK
// host's own. Left in, they would make each agent a child of that session. Sign-in and provider settings, such as
// CLAUDE_CODE_OAUTH_TOKEN or CLAUDE_CODE_USE_BEDROCK, stay.
const SESSION_MARKERS = [
  "CLAUDECODE",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_BRIDGE_SESSION_ID",
  "CLAUDE_CODE_REMOTE_SESSION_ID",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_PID",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_AGENT_SDK_VERSION",
];
const RESULTS_HEADER = `# Results

Each section is one batch: the driver, date, skill commit, individual scores, mean and spread (maximum minus minimum). A covered lesson scores 1, a partly covered one 0.5 and a missing one 0. The case repos are private, so the grader's quotes and replay notes stay in the run folder.
`;

class Refused extends Error {}

async function runBatch(kase, options) {
  const skill = options.skillRef ? git(skillDir, "rev-parse", "--verify", `${options.skillRef}^{commit}`) : skillCommit();
  const results = [];
  for (let i = 0; i < options.runs; i++) {
    if (interrupted) throw new Error(`stopped by ${interrupted}`);
    if (options.waitForIdle) await waitForIdle();
    results.push(await runCase(kase, { ...options, skill }));
  }
  appendResults(kase, skill, options.agent, results);
}

async function waitForIdle() {
  for (;;) {
    if (interrupted) throw new Error(`stopped by ${interrupted}`);
    const rows = spawnSync("ps", ["-axww", "-o", "pid=,ppid=,command="], { encoding: "utf8" });
    if (rows.status !== 0) throw new Error("cannot check running builds before eval");
    const processes = rows.stdout.split("\n").map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean);
    const parents = new Map(processes.map(([, pid, ppid]) => [Number(pid), Number(ppid)]));
    const ancestors = new Set();
    for (let pid = process.pid; pid > 1 && !ancestors.has(pid); pid = parents.get(pid) ?? 1) ancestors.add(pid);
    const busy = processes.some(([, pid, , command]) => {
      if (ancestors.has(Number(pid))) return false;
      return /evals\/run\.mjs|(?:^|[ /])cargo(?:\s|$)|expo\s+run/.test(command)
        || (/(?:^|[ /])xcodebuild(?:\s|$)/.test(command) && !/-license\s+check/.test(command));
    });
    const load = loadavg();
    if (load[1] < 8 && !busy) return;
    console.log(`Waiting for a quiet machine: load ${load.join(", ")}${busy ? "; another eval or build is running" : ""}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 30_000));
  }
}

async function runCase(kase, options) {
  const load = loadavg();
  const run = prepare(kase, options);
  console.log(`${kase.name}: starting load ${load.join(", ")}`);
  console.log(`${kase.name}: run folder ${run.dir}, checkout ${run.checkout}`);
  let changed = null;
  let failure;
  try {
    console.log(`${kase.name}: create is running`);
    const create = await agent(run, "create", "/verification-skill create");
    const createLeft = await sweep(run);
    changed = keepChanges(run);
    console.log(`${kase.name}: grading ${changed.length} changed files`);
    const grade = await agent(run, "grade", gradePrompt(kase, changed), GRADE_SCHEMA);
    const gradeLeft = await sweep(run);
    writeFileSync(join(run.dir, "grade.json"), `${JSON.stringify(grade.output, null, 2)}\n`);
    const result = scored(kase, grade.output);
    writeFileSync(join(run.dir, "result.json"), JSON.stringify({ driver: run.driver, skill: run.skill, load, score: result.points, create, grade, createLeft, gradeLeft }, null, 2));
    console.log(`${kase.name}: ${result.score} at skill ${run.skill}, create on ${create.model}, the grade on ${grade.model}.`);
    return { run, result, load, create, grade, createLeft, gradeLeft };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await cleanUp(run, changed, failure);
  }
}

async function cleanUp(run, changed, failure) {
  const steps = { "stop its processes": () => sweep(run), "keep what create wrote": () => changed ?? keepChanges(run), "delete the temp folder": () => removeWork(run) };
  const errors = [];
  for (const [step, action] of Object.entries(steps)) {
    try {
      await action();
    } catch (error) {
      errors.push(new Error(`${run.id}: could not ${step}: ${error.message}`, { cause: error }));
    }
  }
  if (errors.length) throw new AggregateError(failure ? [failure, ...errors] : errors, `${run.id}: cleanup failed`, { cause: failure });
}

function caseNames() {
  return readdirSync(casesDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
}

function readCase(name) {
  const file = join(casesDir, `${name}.md`);
  if (!existsSync(file)) throw new Refused(`no case "${name}"; the cases are ${caseNames().join(", ") || "none"}`);
  const text = readFileSync(file, "utf8");
  const field = (label) => text.match(new RegExp(`^- ${label}: (.+)$`, "m"))?.[1].trim();
  const [repo, checkout, base] = ["Repo", "Checkout", "Base"].map(field);
  const lessons = (text.split(/^## Lessons$/m)[1] ?? "")
    .split("\n")
    .map((line) => line.match(/^(\d+)\. (.+)$/))
    .filter(Boolean)
    .map(([, n, lesson]) => ({ n: Number(n), text: lesson }));

  const problems = [];
  for (const [label, value] of [["Repo", repo], ["Checkout", checkout], ["Base", base]]) if (!value) problems.push(`no "- ${label}:" line`);
  if (base && !/^[0-9a-f]{40}$/.test(base)) problems.push("Base must be a full commit SHA");
  if (!lessons.length) problems.push('no numbered lessons under "## Lessons"');
  lessons.forEach((lesson, i) => {
    if (lesson.n !== i + 1) problems.push(`lesson ${lesson.n} should be numbered ${i + 1}`);
    if (!CITATION.test(lesson.text)) problems.push(`lesson ${lesson.n} cites no commit or PR`);
  });
  if (problems.length) throw new Refused(`${file}: ${problems.join("; ")}`);
  return { name, repo, checkout: checkout.replace(/^~(?=\/)/, homedir()), base, lessons };
}

function list() {
  const lines = caseNames().map((name) => {
    const { repo, base, lessons } = readCase(name);
    return `  ${name.padEnd(10)} ${repo} at ${base.slice(0, 8)}, ${lessons.length} lessons`;
  });
  console.log(`${USAGE}\n\ncases:\n${lines.join("\n")}`);
}

function git(cwd, ...args) {
  const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8", maxBuffer: 256 << 20 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

// The run folder keeps the transcripts and the grade. What the agents touch, the checkout, their config folders and
// the gh stand-in, goes in a separate temp folder, away from earlier runs' grades, which hold the lessons.
//
// The checkout is a clone that shares the case repo's objects but none of its refs, config or hooks. A worktree would
// share all three, so the agent could read the hand-fixed skill on main, and an install step's hook installer would
// write into the case repo. Later commits stay readable by hash, but no ref or reflog leads to them.
function prepare(kase, { agent: driver, skill, skillRef }) {
  if (!existsSync(kase.checkout)) throw new Refused(`no checkout of ${kase.repo} at ${kase.checkout}`);
  if (spawnSync("git", ["-C", kase.checkout, "cat-file", "-e", `${kase.base}^{commit}`]).status !== 0) {
    throw new Refused(`${kase.checkout} has no commit ${kase.base}; fetch it first`);
  }
  const id = `${kase.name}-${new Date().toISOString().replace(/[-:]|\.\d+/g, "")}`;
  mkdirSync(join(runsDir, id), { recursive: true });
  const dir = realpathSync(join(runsDir, id));
  const work = realpathSync(mkdtempSync(join(tmpdir(), "verification-skill-eval-")));
  const checkout = join(work, "checkout");
  try {
    git(work, "clone", "--quiet", "--shared", "--no-checkout", kase.checkout, checkout);
    git(checkout, "checkout", "--quiet", "--detach", kase.base);
    git(checkout, "remote", "remove", "origin");
    for (const ref of git(checkout, "for-each-ref", "--format=%(refname)").split("\n").filter(Boolean)) git(checkout, "update-ref", "-d", ref);
    rmSync(join(checkout, ".git", "logs"), { recursive: true, force: true });

    const bin = join(work, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "gh"), GH_OFF);
    chmodSync(join(bin, "gh"), 0o755);
    installDeviceGuard(bin, join(dir, "device-guard.log"));
    const configs = { create: join(work, `${driver}-create`), grade: join(work, `${driver}-grade`) };
    const source = join(work, "source");
    const repoRoot = git(skillsDir, "rev-parse", "--show-toplevel");
    if (skillRef) {
      mkdirSync(source);
      const archive = spawnSync("git", ["-C", repoRoot, "archive", skill, relative(repoRoot, skillsDir) || "."], { maxBuffer: 32 << 20 });
      if (archive.status !== 0) throw new Error("cannot archive the pinned skill");
      const unpack = spawnSync("tar", ["-xf", "-", "-C", source], { input: archive.stdout });
      if (unpack.status !== 0) throw new Error("cannot unpack the pinned skill");
    }
    for (const config of Object.values(configs)) {
      copySkill(join(config, "skills"), skillRef ? join(source, relative(repoRoot, skillDir)) : skillDir);
      if (driver === "codex") {
        const auth = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
        if (existsSync(auth)) symlinkSync(auth, join(config, "auth.json"));
      }
    }
    rmSync(source, { recursive: true, force: true });
    const model = driver === "codex" ? JSON.parse(readFileSync(join(skillsDir, "models.json"), "utf8")).jobs.eval.use : null;
    const env = (phase) => {
      const vars = { ...process.env, ...noPush(process.env), CLAUDE_CONFIG_DIR: configs[phase], ...(driver === "codex" ? { CODEX_HOME: configs[phase] } : {}), PATH: `${bin}:${process.env.PATH}`, GH_TOKEN: "off", GITHUB_TOKEN: "off", [MARKER]: id };
      for (const key of SESSION_MARKERS) delete vars[key];
      return vars;
    };
    return { id, dir, work, checkout, env, skill, driver, model, trail: [], simulators: new Map(simulators().map((d) => [d.udid, d.state])) };
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
}

// The skill without its evals, which hold the answers, plus each file outside it that it links to, at the same
// relative place so the links resolve.
function copySkill(skills, skillDir) {
  const skillsDir = dirname(skillDir);
  const evalsDir = join(skillDir, "evals");
  const target = join(skills, basename(skillDir));
  const inEvals = (path) => path === evalsDir || path.startsWith(evalsDir + sep);
  cpSync(skillDir, target, { recursive: true, filter: (src) => !inEvals(src) });
  const docs = readdirSync(skillDir, { recursive: true }).map((f) => join(skillDir, f)).filter((f) => f.endsWith(".md") && !inEvals(f));
  for (const doc of docs) {
    for (const [, link] of readFileSync(doc, "utf8").matchAll(/\]\((\.\.\/[^)#\s]+)/g)) {
      const linked = resolve(dirname(doc), link);
      if (linked.startsWith(skillDir + sep)) continue;
      if (!existsSync(linked)) throw new Error(`${relative(skillsDir, doc)} links to ${link}, which does not exist`);
      cpSync(linked, join(skills, relative(skillsDir, linked)));
    }
  }
}

// Every file create added or changed, copied into the run folder, which outlives the checkout. A link, such as a skill
// folder linked into .claude/skills, stays a link.
function keepChanges(run) {
  git(run.checkout, "add", "--all", "--intent-to-add");
  const files = git(run.checkout, "diff", "--name-only", "HEAD").split("\n").filter(Boolean);
  writeFileSync(join(run.dir, "changes.patch"), `${git(run.checkout, "diff", "--binary", "HEAD")}\n`);
  for (const file of files) {
    if (existsSync(join(run.checkout, file))) cpSync(join(run.checkout, file), join(run.dir, "changes", file), { recursive: true, verbatimSymlinks: true });
  }
  return files;
}

function removeWork(run) {
  try {
    rmSync(run.work, { recursive: true, force: true });
  } catch {
    // A build can leave read-only folders behind, which rm cannot empty until they are writable again.
    spawnSync("chmod", ["-R", "u+w", run.work]);
    rmSync(run.work, { recursive: true, force: true });
  }
}

let running = null;
let interrupted = null;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = signal;
    if (running) stopGroup(running);
  });
}

function stopGroup(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
}

function agent(run, phase, prompt, schema) {
  if (interrupted) return Promise.reject(new Error(`stopped by ${interrupted}`));
  const transcript = join(run.dir, `${phase}.jsonl`);
  const out = openSync(transcript, "w");
  const err = openSync(join(run.dir, `${phase}.stderr`), "w");
  let args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions", "--append-system-prompt", UNATTENDED];
  const lastMessage = join(run.dir, `${phase}.output.json`);
  if (run.driver === "codex") {
    args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--model", run.model.model,
      "-c", `model_reasoning_effort=${JSON.stringify(run.model.effort)}`, "--output-last-message", lastMessage];
    if (schema) {
      const schemaFile = join(run.work, "grade-schema.json");
      writeFileSync(schemaFile, JSON.stringify(schema));
      args.push("--output-schema", schemaFile);
    }
    args.push(`${UNATTENDED}\n\n${prompt}`);
  } else if (schema) args.push("--json-schema", JSON.stringify(schema));
  const started = Date.now();
  return new Promise((resolvePhase, reject) => {
    // Its own process group, so a timeout or Ctrl-C stops the agent and whatever it is running.
    const child = spawn(run.driver, args, { cwd: run.checkout, env: run.env(phase), stdio: ["ignore", out, err], detached: true });
    running = child;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopGroup(child);
    }, MINUTES[phase] * 60_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      running = null;
      closeSync(out);
      closeSync(err);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      running = null;
      closeSync(out);
      closeSync(err);
      const events = readEvents(transcript);
      run.trail.push(simulatorTrail(events));
      const result = events.findLast((e) => e.type === (run.driver === "codex" ? "turn.completed" : "result"));
      if (code !== 0 || interrupted || timedOut || !result || result.is_error) {
        const why = interrupted ? `, stopped by ${interrupted}` : timedOut ? `, stopped after ${MINUTES[phase]} min` : "";
        reject(new Error(`${phase}: the agent run failed (exit ${code}${why}), transcript ${transcript}`));
        return;
      }
      try {
        resolvePhase({
        model: run.model?.model ?? events.find((e) => e.type === "system" && e.subtype === "init")?.model ?? "an unknown model",
        minutes: Math.round((Date.now() - started) / 60_000),
        output: run.driver === "codex" && schema ? JSON.parse(readFileSync(lastMessage, "utf8")) : result.structured_output,
        });
      } catch {
        reject(new Error(`${phase}: cannot read structured output, transcript ${transcript}`));
      }
    });
  });
}

// A hard kill can cut the last line short, so a line that isn't a JSON object is skipped.
function readEvents(transcript) {
  return readFileSync(transcript, "utf8")
    .split("\n")
    .flatMap((line) => {
      try {
        const event = JSON.parse(line);
        return event && typeof event === "object" ? [event] : [];
      } catch {
        return [];
      }
    });
}

// The agent's shell commands, plus what each `simctl create` printed, which is the new simulator's UDID.
function simulatorTrail(events) {
  const commands = new Map();
  const trail = [];
  for (const event of events) {
    if (event.item?.type === "command_execution") {
      trail.push(event.item.command);
      if (/simctl\s+create/.test(event.item.command)) trail.push(event.item.aggregated_output);
    }
    for (const part of Array.isArray(event.message?.content) ? event.message.content : []) {
      if (part.type === "tool_use" && part.name === "Bash") {
        commands.set(part.id, part.input.command);
        trail.push(part.input.command);
      }
      if (part.type === "tool_result" && /simctl\s+create/.test(commands.get(part.tool_use_id) ?? "")) trail.push(JSON.stringify(part.content));
    }
  }
  return trail.join("\n");
}

function gradePrompt(kase, changed) {
  return `You are grading a project verify skill that another agent wrote a moment ago, by running \`/verification-skill create\` in this checkout of ${kase.repo} at ${kase.base.slice(0, 8)}.

The files it wrote or changed:
${changed.map((f) => `- ${f}`).join("\n") || "- none"}

1. Score the new files against the lessons below. Each lesson is a fix that this repo's own verify skill needed by hand after its first version. Give each lesson one verdict:
   - \`covered\`: a line in the new files states the rule, or a recipe applies it, firmly enough that an agent following the skill would act on it in this repo.
   - \`partly\`: the skill touches the concern but still lets the mistake happen. For example, it names the risk without a step that prevents it, or it covers one half of a two-part lesson.
   - \`missing\`: nothing in the new files would stop the mistake.
   A file the new skill sends the agent to for that step counts as part of the skill. For \`covered\` and \`partly\`, quote the line and name its file. Judge what the files say, not what their author meant. A general line that only mentions the topic is \`partly\` at most.
2. Replay the new skill as a fresh agent would: its launch, then doctor, then one drive recipe from its feature map, then cleanup, exactly as written. Give each step \`passed\`, \`failed\` with the error, or \`skipped\` with the reason, such as a credential or a device this run doesn't have. Don't fix the skill or the app. Stop only processes you started, and leave none running.

Lessons:
${kase.lessons.map((l) => `${l.n}. ${l.text}`).join("\n")}`;
}

const STEP = { type: "object", additionalProperties: false, properties: { result: { enum: ["passed", "failed", "skipped"] }, note: { type: "string" } }, required: ["result", "note"] };
const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    lessons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { lesson: { type: "integer" }, verdict: { enum: Object.keys(POINTS) }, file: { type: "string" }, quote: { type: "string" }, why: { type: "string" } },
        required: ["lesson", "verdict", "file", "quote", "why"],
      },
    },
    replay: { type: "object", additionalProperties: false, properties: Object.fromEntries(REPLAY.map((step) => [step, STEP])), required: REPLAY },
  },
  required: ["lessons", "replay"],
};

// Stops each process this run started: one that carries the run's marker, works inside the temp folder or names it on
// its command line, and every child of those. Then shuts down each simulator the run booted. The run folder doesn't
// count, so a `tail -f` on one of its transcripts survives.
async function sweep(run) {
  const ancestors = new Set();
  const procs = processes();
  for (let pid = process.pid; pid > 1 && !ancestors.has(pid); pid = procs.get(pid)?.ppid ?? 1) ancestors.add(pid);
  const inside = (path) => path === run.work || path.startsWith(run.work + sep);
  const ours = new Set();
  for (const p of procs.values()) if (p.env.includes(`${MARKER}=${run.id}`) || inside(p.cwd) || p.command.includes(run.work)) ours.add(p.pid);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of procs.values()) {
      if (!ours.has(p.pid) && ours.has(p.ppid)) {
        ours.add(p.pid);
        grew = true;
      }
    }
  }
  for (const pid of ancestors) ours.delete(pid);
  await stop([...ours]);
  const left = [...ours].map((pid) => basename(procs.get(pid).command.split(" ")[0]));
  return [...left, ...stopSimulators(run)];
}

function processes() {
  const rows = (flags) =>
    new Map(
      spawnSync("ps", [flags, "-o", "pid=,ppid=,command="], { encoding: "utf8", maxBuffer: 256 << 20 })
        .stdout.split("\n")
        .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s(.*)$/))
        .filter(Boolean)
        .map(([, pid, ppid, command]) => [Number(pid), { pid: Number(pid), ppid: Number(ppid), command }]),
    );
  // macOS shows another process's environment only for binaries that aren't Apple's, so the cwd catches the rest.
  const withEnv = rows("-axwwE");
  const cwds = new Map();
  let pid;
  for (const line of spawnSync("lsof", ["-a", "-d", "cwd", "-u", String(process.getuid()), "-Fpn"], { encoding: "utf8", maxBuffer: 64 << 20 }).stdout.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    if (line.startsWith("n")) cwds.set(pid, line.slice(1));
  }
  const procs = rows("-axww");
  for (const p of procs.values()) Object.assign(p, { env: withEnv.get(p.pid)?.command ?? "", cwd: cwds.get(p.pid) ?? "" });
  return procs;
}

async function stop(pids) {
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code === "EPERM";
    }
  };
  const signal = (sig) => {
    for (const pid of pids.filter(alive)) {
      try {
        process.kill(pid, sig);
      } catch (error) {
        // A parent that passes the signal on can stop its child before the child's turn comes.
        if (error.code !== "ESRCH") throw error;
      }
    }
  };
  const gone = async (seconds) => {
    for (let i = 0; i < seconds * 10 && pids.some(alive); i++) await new Promise((r) => setTimeout(r, 100));
  };
  signal("SIGTERM");
  await gone(5);
  signal("SIGKILL");
  await gone(2);
  const stuck = pids.filter(alive);
  if (stuck.length) throw new Error(`could not stop processes ${stuck.join(", ")}`);
}

function simulators() {
  const list = spawnSync("xcrun", ["simctl", "list", "devices", "--json"], { encoding: "utf8", maxBuffer: 64 << 20 });
  return list.status === 0 ? Object.values(JSON.parse(list.stdout).devices).flat() : [];
}

// A simulator counts as the run's only when one of its commands named it, because other agents may boot their own.
function stopSimulators(run) {
  const said = run.trail.join("\n");
  const booted = simulators().filter((d) => d.state === "Booted" && run.simulators.get(d.udid) !== "Booted" && said.includes(d.udid));
  for (const d of booted) spawnSync("xcrun", ["simctl", "shutdown", d.udid]);
  return booted.map((d) => `simulator ${d.name}`);
}

function scored(kase, output) {
  const verdicts = new Map((output?.lessons ?? []).map((l) => [l.lesson, l.verdict]));
  const lessons = kase.lessons.map((l) => ({ ...l, verdict: verdicts.get(l.n) }));
  const missing = lessons.filter((l) => !(l.verdict in POINTS)).map((l) => l.n);
  if (missing.length) throw new Error(`the grader gave no verdict for lessons ${missing.join(", ")}`);
  const points = lessons.reduce((sum, l) => sum + POINTS[l.verdict], 0);
  return { lessons, points, score: `${points} of ${lessons.length} (${Math.round((100 * points) / lessons.length)}%)` };
}

function skillCommit() {
  const sha = spawnSync("git", ["-C", skillDir, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  if (sha.status !== 0) return "outside git";
  const changed = git(skillDir, "status", "--porcelain", "--", ".", ":(exclude)evals");
  return `${sha.stdout.trim()}${changed ? " with uncommitted changes" : ""}`;
}

function resultDetails({ result, create, grade, createLeft, gradeLeft, load }, index) {
  const replay = REPLAY.map((step) => `${step} ${grade.output.replay?.[step]?.result ?? "not reported"}`).join(", ");
  const left = (names) => names.join(", ") || "nothing";
  return [
    `### Run ${index + 1}: Score ${result.score}. Create took ${create.minutes} min, and the grade ${grade.minutes} min.`,
    `Starting load (1, 5, 15 min): ${load.join(", ")}.`,
    `Replay: ${replay}.`,
    `Left behind, and stopped by the eval: after create: ${left(createLeft)}; after the grade: ${left(gradeLeft)}.`,
    "",
    "| Lesson | Verdict |",
    "| --- | --- |",
    ...result.lessons.map((l) => `| ${l.n}. ${l.text.replaceAll("|", "\\|")} | ${l.verdict} |`),
  ].join("\n");
}

function appendResults(kase, skill, driver, results) {
  const scores = results.map(({ result }) => result.points);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const low = Math.min(...scores), high = Math.max(...scores);
  const section = [
    `## ${kase.name}, ${new Date().toLocaleDateString("en-CA")}, skill ${skill}`,
    "",
    `Driver: ${driver}. Runs: ${results.length}.`,
    `Mean ${Number(mean.toFixed(2))} of ${kase.lessons.length} (${Math.round(100 * mean / kase.lessons.length)}%). Spread ${high - low} (${low} to ${high}).`,
    "",
    ...results.map(resultDetails),
  ].join("\n");
  appendFileSync(resultsFile, `${existsSync(resultsFile) ? "" : RESULTS_HEADER}\n${section}\n`);
  console.log(`${kase.name}: mean ${Number(mean.toFixed(2))}, spread ${high - low}. Results in ${resultsFile}`);
}

function parseArgs(args) {
  let name;
  const options = { agent: "codex", runs: 3 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent") options.agent = args[++i];
    else if (arg === "--runs") options.runs = Number(args[++i]);
    else if (arg === "--skill-ref") {
      options.skillRef = args[++i];
      if (!options.skillRef || options.skillRef.startsWith("-")) throw new Refused("--skill-ref needs a commit");
    }
    else if (arg === "--wait-for-idle") options.waitForIdle = true;
    else if (!arg.startsWith("-") && !name) name = arg;
    else throw new Refused(USAGE);
  }
  if (!["codex", "claude"].includes(options.agent)) throw new Refused("--agent must be codex or claude");
  if (!Number.isSafeInteger(options.runs) || options.runs < 1) throw new Refused("--runs must be a positive integer");
  return { name, ...options };
}

try {
  const { name, ...options } = parseArgs(process.argv.slice(2));
  if (name) await runBatch(readCase(name), options);
  else list();
} catch (error) {
  console.error(error instanceof Refused ? error.message : error);
  process.exitCode = error instanceof Refused ? 2 : 1;
}
if (interrupted) process.exitCode = 130;
