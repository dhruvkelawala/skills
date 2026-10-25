#!/usr/bin/env node
// Replays `/verification-skill create` on a case repo at the commit before its verify skill existed, has a second
// agent score what it wrote against the lessons the repo's own history taught, and appends the score to results.md.
//
//   node skills/verification-skill/evals/run.mjs           list the cases
//   node skills/verification-skill/evals/run.mjs <case>    run one case end to end
//
// README.md says what a run does and what it needs.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(evalsDir);
const skillsDir = dirname(skillDir);
const casesDir = join(evalsDir, "cases");
const resultsFile = join(evalsDir, "results.md");
const runsDir = join(homedir(), ".cache", "verification-skill-evals");
const USAGE = "usage: node skills/verification-skill/evals/run.mjs [<case>]";
// A short SHA with at least one digit, or a PR number, inside parentheses.
const CITATION = /\([^)]*(?:\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b|#\d+)[^)]*\)/;
// Every process an agent starts inherits this variable, so the sweep can find it after the agent exits.
const MARKER = "VERIFICATION_SKILL_EVAL_RUN";
// Caps against a hung agent, well above an iOS build plus the agent's own retries.
const MINUTES = { create: 180, grade: 90 };
const POINTS = { covered: 1, partly: 0.5, missing: 0 };
const REPLAY = ["launch", "doctor", "drive", "cleanup"];
const UNATTENDED = "Nobody can answer questions during this run.";
const GH_OFF = '#!/bin/sh\necho "gh is off in this eval, so nothing reaches the case repo on GitHub" >&2\nexit 1\n';
const RESULTS_HEADER = `# Results

Each section is one run of \`run.mjs <case>\`: the date, the skill's commit, the score and each lesson's verdict. A covered lesson scores 1, a partly covered one 0.5 and a missing one 0. The case repos are private, so the grader's quotes and replay notes stay in the run folder.
`;

class Refused extends Error {}

async function runCase(kase) {
  const run = prepare(kase);
  console.log(`${kase.name}: run folder ${run.dir}, checkout ${run.checkout}`);
  let changed = null;
  try {
    console.log(`${kase.name}: create is running`);
    const create = await agent(run, "create", "/verification-skill create");
    const createLeft = await sweep(run, create);
    changed = keepChanges(run);
    console.log(`${kase.name}: grading ${changed.length} changed files`);
    const grade = await agent(run, "grade", gradePrompt(kase, changed), GRADE_SCHEMA);
    const gradeLeft = await sweep(run, grade);
    writeFileSync(join(run.dir, "grade.json"), `${JSON.stringify(grade.output, null, 2)}\n`);
    const result = scored(kase, grade.output);
    appendResult(kase, result, { create, grade, createLeft, gradeLeft });
    console.log(`${kase.name}: ${result.score} at skill ${skillCommit()}. Results in ${resultsFile}`);
  } finally {
    await sweep(run);
    try {
      if (!changed) keepChanges(run);
    } finally {
      removeWork(run);
    }
  }
}

// --- the case

function caseNames() {
  return existsSync(casesDir) ? readdirSync(casesDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort() : [];
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

// --- the run folder and its checkout

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
function prepare(kase) {
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
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }

  const bin = join(work, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), GH_OFF);
  chmodSync(join(bin, "gh"), 0o755);
  const configs = { create: join(work, "claude-create"), grade: join(work, "claude-grade") };
  copySkill(join(configs.create, "skills"));
  mkdirSync(configs.grade);
  const env = (phase) => {
    const vars = { ...process.env, CLAUDE_CONFIG_DIR: configs[phase], PATH: `${bin}:${process.env.PATH}`, GH_TOKEN: "off", GITHUB_TOKEN: "off", [MARKER]: id };
    // Drop the markers of an enclosing Claude Code session so each agent starts as its own session.
    for (const key of Object.keys(vars)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete vars[key];
    return vars;
  };
  return { id, dir, work, checkout, env, simulators: new Map(simulators().map((d) => [d.udid, d.state])) };
}

// The skill without its evals, which hold the answers, plus each file outside it that it links to, at the same
// relative place so the links resolve.
function copySkill(skills) {
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

// Every file create added or changed, copied into the run folder, which outlives the checkout.
function keepChanges(run) {
  git(run.checkout, "add", "--all", "--intent-to-add");
  const files = git(run.checkout, "diff", "--name-only", "HEAD").split("\n").filter(Boolean);
  writeFileSync(join(run.dir, "changes.patch"), `${git(run.checkout, "diff", "--binary", "HEAD")}\n`);
  for (const file of files) if (existsSync(join(run.checkout, file))) cpSync(join(run.checkout, file), join(run.dir, "changes", file));
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

// --- the agents

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
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions", "--append-system-prompt", UNATTENDED];
  if (schema) args.push("--json-schema", JSON.stringify(schema));
  const started = Date.now();
  return new Promise((resolvePhase, reject) => {
    // Its own process group, so a timeout or Ctrl-C stops the agent and whatever it is running.
    const child = spawn("claude", args, { cwd: run.checkout, env: run.env(phase), stdio: ["ignore", out, err], detached: true });
    running = child;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopGroup(child);
    }, MINUTES[phase] * 60_000);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timer);
      running = null;
      closeSync(out);
      closeSync(err);
      const events = readFileSync(transcript, "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
      const result = events.findLast((e) => e.type === "result");
      if (!result || result.is_error) {
        const why = interrupted ? `, stopped by ${interrupted}` : timedOut ? `, stopped after ${MINUTES[phase]} min` : "";
        reject(new Error(`${phase}: the agent run failed (exit ${code}${why}), transcript ${transcript}`));
        return;
      }
      resolvePhase({
        model: events.find((e) => e.type === "system" && e.subtype === "init")?.model ?? "an unknown model",
        minutes: Math.round((Date.now() - started) / 60_000),
        said: simulatorTrail(events),
        output: result.structured_output,
      });
    });
  });
}

// The agent's shell commands, plus what each `simctl create` printed, which is the new simulator's UDID.
function simulatorTrail(events) {
  const commands = new Map();
  const trail = [];
  for (const event of events) {
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

const STEP = { type: "object", properties: { result: { enum: ["passed", "failed", "skipped"] }, note: { type: "string" } }, required: ["result", "note"] };
const GRADE_SCHEMA = {
  type: "object",
  properties: {
    lessons: {
      type: "array",
      items: {
        type: "object",
        properties: { lesson: { type: "integer" }, verdict: { enum: Object.keys(POINTS) }, file: { type: "string" }, quote: { type: "string" }, why: { type: "string" } },
        required: ["lesson", "verdict", "why"],
      },
    },
    replay: { type: "object", properties: Object.fromEntries(REPLAY.map((step) => [step, STEP])), required: REPLAY },
  },
  required: ["lessons", "replay"],
};

// --- what the run left behind

// Stops each process this run started: one that carries the run's marker, works inside the temp folder or names it on
// its command line, and every child of those. Then shuts down each simulator the phase booted. The run folder doesn't
// count, so a `tail -f` on one of its transcripts survives.
async function sweep(run, phase) {
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
  return phase ? [...left, ...stopSimulators(run, phase.said)] : left;
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
  const signal = (sig) => pids.filter(alive).forEach((pid) => process.kill(pid, sig));
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
  if (process.platform !== "darwin") return [];
  const list = spawnSync("xcrun", ["simctl", "list", "devices", "--json"], { encoding: "utf8", maxBuffer: 64 << 20 });
  return list.status === 0 ? Object.values(JSON.parse(list.stdout).devices).flat() : [];
}

// A simulator counts as the run's only when one of its commands named it, because other agents may boot their own.
function stopSimulators(run, said) {
  const booted = simulators().filter((d) => d.state === "Booted" && run.simulators.get(d.udid) !== "Booted" && said.includes(d.udid));
  for (const d of booted) spawnSync("xcrun", ["simctl", "shutdown", d.udid]);
  return booted.map((d) => `simulator ${d.name}`);
}

// --- the result

function scored(kase, output) {
  const verdicts = new Map((output?.lessons ?? []).map((l) => [l.lesson, l.verdict]));
  const lessons = kase.lessons.map((l) => ({ ...l, verdict: verdicts.get(l.n) }));
  const missing = lessons.filter((l) => !(l.verdict in POINTS)).map((l) => l.n);
  if (missing.length) throw new Error(`the grader gave no verdict for lessons ${missing.join(", ")}`);
  const points = lessons.reduce((sum, l) => sum + POINTS[l.verdict], 0);
  return { lessons, score: `${points} of ${lessons.length} (${Math.round((100 * points) / lessons.length)}%)` };
}

function skillCommit() {
  const sha = spawnSync("git", ["-C", skillDir, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  if (sha.status !== 0) return "outside git";
  const changed = git(skillDir, "status", "--porcelain", "--", ".", ":(exclude)evals");
  return `${sha.stdout.trim()}${changed ? " with uncommitted changes" : ""}`;
}

function appendResult(kase, result, { create, grade, createLeft, gradeLeft }) {
  const replay = REPLAY.map((step) => `${step} ${grade.output.replay?.[step]?.result ?? "not reported"}`).join(", ");
  const left = (names) => names.join(", ") || "nothing";
  const section = [
    `## ${kase.name}, ${new Date().toLocaleDateString("en-CA")}, skill ${skillCommit()}`,
    "",
    `Score ${result.score}. Create took ${create.minutes} min on ${create.model}, and the grade ${grade.minutes} min on ${grade.model}.`,
    `Replay: ${replay}.`,
    `Left behind, and stopped by the eval: after create: ${left(createLeft)}; after the grade: ${left(gradeLeft)}.`,
    "",
    "| Lesson | Verdict |",
    "| --- | --- |",
    ...result.lessons.map((l) => `| ${l.n}. ${l.text.replaceAll("|", "\\|")} | ${l.verdict} |`),
  ].join("\n");
  appendFileSync(resultsFile, `${existsSync(resultsFile) ? "" : RESULTS_HEADER}\n${section}\n`);
}

try {
  const name = process.argv[2];
  if (name) await runCase(readCase(name));
  else list();
} catch (error) {
  console.error(error instanceof Refused ? error.message : error);
  process.exitCode = error instanceof Refused ? 2 : 1;
}
if (interrupted) process.exitCode = 130;
