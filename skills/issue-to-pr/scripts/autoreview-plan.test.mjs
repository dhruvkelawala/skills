import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./autoreview-plan.mjs", import.meta.url));
const risks = () => ({ authority: false, storedData: false, money: false, productionSwitch: false, oneWayDoor: false });

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "autoreview-plan-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  const commit = (path, contents) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), contents);
    git("add", "-A");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  const base = commit("app.js", "export const value = 1;\n");
  const head = commit("app.js", "export const value = 2;\n");
  const tree = git("rev-parse", "HEAD^{tree}");
  const record = join(dir, "7.md");
  writeFileSync(record, `base_sha: ${base}\nreview_policy: conditional-v1\nlane: light\n\n## Contract\n\nChange the displayed value.\n\n## Build report\n\nPassed.\n`);
  const facts = {
    reviews: ["standards", "spec"].map((axis) => ({ axis, reviewer: axis, status: "completed", family: "codex", model: "actual-model", base, head, tree, contract: "Change the displayed value.", access: { repository: true, contract: true, standards: true, tests: true }, coverage: "full", fallback: false, risks: risks() })),
    openP0P1: false,
    contractRisks: risks(),
    configuration: { complete: true, paths: [] },
    hostedReviewer: { configured: true, available: true, bot: true, login: "review-bot", source: "recent merged PRs" },
    userRequested: false,
  };
  const edit = (change) => writeFileSync(record, change(readFileSync(record, "utf8")));
  const outcome = (value) => edit((text) => `autoreview: ${value}\n${text}`);
  const run = (command = "stage3", ...flags) => {
    const factsPath = join(dir, "facts.json");
    writeFileSync(factsPath, JSON.stringify(facts));
    const result = spawnSync(process.execPath, [CLI, command, record, ...(command === "stage3" ? [factsPath] : []), ...flags], { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  return { repo, base, head, tree, record, facts, git, commit, edit, outcome, run };
}

test("a fully eligible pilot skip records its computed basis and survives a same-basis retry", (t) => {
  const f = fixture(t);
  const plan = f.run();
  assert.equal(plan.decision, "skip");
  assert.deepEqual(plan.reasons, ["eligible"]);
  assert.equal(plan.basis.base, f.base);
  assert.equal(plan.basis.head, f.head);
  assert.equal(plan.basis.tree, f.tree);
  assert.deepEqual(plan.basis.paths, ["app.js"]);
  assert.deepEqual(f.run(), plan);
  assert.doesNotMatch(readFileSync(f.record, "utf8"), /^autoreview: .*clean/m);
  f.outcome("skipped: conditional-v1, eligible");
  const publication = f.run("publish", ...plan.aprArgs);
  assert.equal(publication.decision, "skip");
  assert.equal(publication.reuse, false);
  assert.equal(publication.outcome, "skipped");
});

const retained = [
  ["fallback", (f) => { f.facts.reviews[0].fallback = true; }, "source-fallback"],
  ["limited coverage", (f) => { f.facts.reviews[1].coverage = "limited"; }, "source-coverage"],
  ["unknown coverage", (f) => { delete f.facts.reviews[0].coverage; }, "source-coverage"],
  ["unknown fallback", (f) => { delete f.facts.reviews[1].fallback; }, "source-fallback"],
  ["unknown configuration", (f) => { delete f.facts.configuration; }, "configuration-unknown"],
  ["custom configuration", (f) => { f.facts.configuration.paths = ["app.js"]; }, "configuration-changed"],
  ["no configured hosted reviewer", (f) => { f.facts.hostedReviewer.configured = false; }, "hosted-reviewer"],
  ["unavailable hosted reviewer", (f) => { f.facts.hostedReviewer.available = false; }, "hosted-reviewer"],
  ["human reviewer only", (f) => { f.facts.hostedReviewer.bot = false; }, "hosted-reviewer"],
  ["unknown hosted reviewer", (f) => { delete f.facts.hostedReviewer; }, "hosted-reviewer"],
  ["user requested opinion", (f) => { f.facts.userRequested = true; }, "user-request"],
  ["unknown user request", (f) => { delete f.facts.userRequested; }, "user-request"],
  ["unknown finding disposition", (f) => { delete f.facts.openP0P1; }, "findings-unknown"],
  ["dirty worktree", (f) => { writeFileSync(join(f.repo, "new.txt"), "pending"); }, "worktree-dirty"],
];
for (const risk of Object.keys(risks())) {
  retained.push([`contract ${risk}`, (f) => { f.facts.contractRisks[risk] = true; }, `risk-${risk}`]);
  retained.push([`reviewer ${risk}`, (f) => { f.facts.reviews[0].risks[risk] = true; }, `risk-${risk}`]);
  retained.push([`unknown ${risk}`, (f) => { delete f.facts.reviews[1].risks[risk]; }, `risk-${risk}`]);
}
for (const [name, change, reason] of retained) {
  test(`retains an opinion for ${name} and supplies the concrete trigger`, (t) => {
    const f = fixture(t);
    change(f);
    const plan = f.run();
    assert.equal(plan.decision, "run");
    assert.ok(plan.reasons.includes(reason), JSON.stringify(plan));
    assert.ok(plan.prompt.includes(reason));
  });
}

for (const path of ["package.json", "nested/pnpm-lock.yaml", ".node-version", ".github/workflows/ci.yml", "Dockerfile", "build.gradle", "deno.jsonc", "nested/Cargo.toml", "custom.cmake"]) {
  test(`computes a retained opinion for a change to ${path}`, (t) => {
    const f = fixture(t);
    const head = f.commit(path, "configuration\n");
    for (const review of f.facts.reviews) Object.assign(review, { head, tree: f.git("rev-parse", "HEAD^{tree}") });
    const plan = f.run();
    assert.equal(plan.decision, "run");
    assert.ok(plan.reasons.includes("configuration-changed"));
    assert.ok(plan.prompt.includes(path));
  });
}

for (const lane of ["light", "full"]) {
  test(`a pass-1 repair in the ${lane} lane reassesses a saved skip`, (t) => {
    const f = fixture(t);
    f.edit((text) => text.replace("lane: light", `lane: ${lane}`));
    assert.equal(f.run().decision, "skip");
    f.commit("app.js", "export const value = 3;\n");
    const plan = f.run();
    assert.equal(plan.decision, "run");
    assert.ok(plan.reasons.includes("pass1-tree-changed"));
    assert.equal(plan.basis.tree, f.git("rev-parse", "HEAD^{tree}"));
  });
}

test("a changed contract or new request requires reassessment before stage 3 completes", (t) => {
  const f = fixture(t);
  const first = f.run();
  f.edit((text) => text.replace("\nChange the displayed value.\n", "\nChange the stored value.\n"));
  const next = f.run();
  assert.equal(next.decision, "run");
  assert.ok(next.reasons.includes("contract-changed"));
  assert.notEqual(next.basis.contract, first.basis.contract);
  f.facts.userRequested = true;
  assert.ok(f.run().reasons.includes("user-request"));
});

for (const [name, change] of [
  ["missing axis", (f) => { f.facts.reviews.pop(); }],
  ["incomplete axis", (f) => { f.facts.reviews[0].status = "incomplete"; }],
  ["missing model", (f) => { delete f.facts.reviews[0].model; }],
  ["same reviewer context", (f) => { f.facts.reviews[1].reviewer = "standards"; }],
  ["missing test access", (f) => { delete f.facts.reviews[0].access.tests; }],
  ["false reviewed tree", (f) => { f.facts.reviews[1].tree = f.base; }],
  ["open accepted finding", (f) => { f.facts.openP0P1 = true; }],
]) {
  test(`blocks ${name} instead of substituting autoreview for mandatory review`, (t) => {
    const f = fixture(t);
    change(f);
    assert.equal(f.run().decision, "blocked");
  });
}

test("old records and non-pilot policies retain the existing extra-opinion default", (t) => {
  const f = fixture(t);
  f.edit((text) => text.replace("review_policy: conditional-v1\n", ""));
  delete f.facts.reviews;
  assert.equal(f.run().decision, "run");
  f.edit((text) => `review_policy: other\n${text}`);
  assert.equal(f.run().decision, "run");
});

test("publication gives explicit skip precedence and never reuses a skip reason containing clean", (t) => {
  const f = fixture(t);
  f.outcome(`skipped: clean source reviews, tree ${f.tree}, clean`);
  assert.equal(f.run("publish").decision, "run");
  const skipped = f.run("publish", "--skip-review");
  assert.equal(skipped.decision, "skip");
  assert.equal(skipped.reuse, false);
  assert.equal(skipped.outcome, "skipped");
  f.edit((text) => text.replace(/^autoreview: .*$/m, `autoreview: codex actual-model, tree ${f.tree}, clean`));
  assert.equal(f.run("publish").reuse, true);
  assert.equal(f.run("publish", "--skip-review").reuse, false);
});

test("actual clean reuse requires the reviewed tree and a clean checkout", (t) => {
  const f = fixture(t);
  f.outcome(`claude actual-model, tree ${f.tree}, clean`);
  assert.equal(f.run("publish").reuse, true);
  writeFileSync(join(f.repo, "app.js"), "uncommitted\n");
  assert.equal(f.run("publish").decision, "run");
  f.git("checkout", "--", "app.js");
  f.commit("app.js", "later repair\n");
  assert.equal(f.run("publish").decision, "run");
});

test("a completed opinion is once-only even after repairs and exposes its original basis", (t) => {
  const f = fixture(t);
  f.outcome(`codex actual-model, tree ${f.tree}, 1 fixed`);
  f.commit("app.js", "later repair\n");
  const plan = f.run();
  assert.equal(plan.decision, "skip");
  assert.deepEqual(plan.reasons, ["opinion-already-completed"]);
  assert.equal(plan.reviewedTree, f.tree);
  assert.equal(plan.notRereviewed, true);
  assert.deepEqual(plan.aprArgs, ["--skip-review"]);
});

test("a failed opinion remains incomplete and is never reused as a clean review", (t) => {
  const f = fixture(t);
  f.outcome("incomplete: provider failed");
  f.facts.userRequested = true;
  assert.equal(f.run().decision, "run");
  assert.equal(f.run("publish").decision, "run");
});
