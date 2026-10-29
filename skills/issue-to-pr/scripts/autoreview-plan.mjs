#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { header, setHeader } from "./run-record.mjs";

const SHA = /^[0-9a-f]{40}$/;
const RISKS = ["authority", "storedData", "money", "productionSwitch", "oneWayDoor"];
const ACCESS = ["repository", "contract", "standards", "tests"];
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 24 }).trim();
const text = (value) => typeof value === "string" && value.trim().length > 0;

function main([command, path, ...args]) {
  if (!path || !["stage3", "publish"].includes(command) ||
      (command === "stage3" ? args.length !== 1 : args.length > 1 || (args.length === 1 && args[0] !== "--skip-review"))) {
    console.error("usage: autoreview-plan.mjs stage3 <record> <facts.json> | publish <record|-> [--skip-review]");
    return 2;
  }
  try {
    const record = path === "-" ? "" : readFileSync(path, "utf8");
    const plan = command === "publish"
      ? publication(record, args.includes("--skip-review"))
      : stage3(record, JSON.parse(readFileSync(args[0], "utf8")));
    if (command === "stage3" && path !== "-") {
      writeFileSync(path, setHeader(record, "autoreview_plan", JSON.stringify(plan)));
    }
    console.log(JSON.stringify(plan));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ decision: "blocked", reasons: ["input-unavailable"], detail: String(error.stderr || error.message).trim() }));
    return 0;
  }
}

function stage3(record, facts) {
  const basis = gitBasis(record, facts);
  const completed = completedReview(record);
  if (!inPilot(record)) {
    return completed ? alreadyCompleted(basis, completed) : decision("run", ["policy-default"], basis);
  }
  const reviews = facts?.reviews;
  if (!Array.isArray(reviews) || reviews.length !== 2 ||
      !["standards", "spec"].every((axis) => reviews.some((review) => review?.axis === axis)) ||
      reviews.some((review) => !sourceComplete(review, basis.base)) ||
      reviews[0].reviewer === reviews[1].reviewer ||
      reviews[0].head !== reviews[1].head || reviews[0].tree !== reviews[1].tree) {
    return decision("blocked", ["source-review-incomplete"], basis);
  }
  if (facts.openP0P1 === true) return decision("blocked", ["accepted-findings-open"], basis);
  if (completed) return alreadyCompleted(basis, completed);
  if (header(record, "autoreview").startsWith("incomplete:")) return decision("run", ["opinion-incomplete"], basis);

  const previous = header(record, "autoreview_plan");
  const prior = previous ? JSON.parse(previous) : null;
  if (prior && isDeepStrictEqual(prior.basis, basis)) return prior;

  const reasons = [];
  if (!basis.contract || reviews.some((review) => review.contract !== basis.contract) ||
      (prior && prior.basis.contract !== basis.contract)) reasons.push("contract-changed");
  if (basis.dirty) reasons.push("worktree-dirty");
  if (reviews.some((review) => review.tree !== basis.tree)) reasons.push("pass1-tree-changed");
  if (reviews.some((review) => review.fallback !== false)) reasons.push("source-fallback");
  if (reviews.some((review) => review.coverage !== "full")) reasons.push("source-coverage");
  if (facts.openP0P1 !== false) reasons.push("findings-unknown");

  const config = facts.configuration;
  if (config?.complete !== true || !Array.isArray(config.paths) || !config.paths.every(text)) reasons.push("configuration-unknown");
  const configPaths = basis.paths.filter((path) => configurationPath(path) || config?.paths?.includes(path));
  if (configPaths.length) reasons.push("configuration-changed");
  for (const risk of RISKS) {
    if ([facts.contractRisks, ...reviews.map((review) => review.risks)].some((risks) => risks?.[risk] !== false)) reasons.push(`risk-${risk}`);
  }
  const hosted = facts.hostedReviewer;
  if (hosted?.configured !== true || hosted.available !== true || hosted.bot !== true || !text(hosted.login) || !text(hosted.source)) reasons.push("hosted-reviewer");
  if (facts.userRequested !== false) reasons.push("user-request");
  return decision(reasons.length ? "run" : "skip", reasons.length ? reasons : ["eligible"], basis, configPaths);
}

function publication(record, skip) {
  if (skip) return { decision: "skip", reasons: ["explicit-skip"], reuse: false, outcome: "skipped", aprArgs: ["--skip-review"] };
  const completed = completedReview(record);
  if (inPilot(record) && !completed) {
    const saved = header(record, "autoreview_plan");
    const plan = saved ? JSON.parse(saved) : null;
    const skipped = plan ? plan.decision === "skip" && plan.reasons?.includes("eligible") : header(record, "autoreview").startsWith("skipped:");
    if (skipped && !header(record, "autoreview").startsWith("incomplete:")) {
      return { decision: "blocked", reasons: ["skip-flag-required"], reuse: false, outcome: "skipped", aprArgs: ["--skip-review"] };
    }
  }
  const tree = git("rev-parse", "HEAD^{tree}");
  if (completed?.result === "clean" && completed.tree === tree && !git("status", "--porcelain")) {
    return { decision: "skip", reasons: ["clean-result-reused"], reuse: true, outcome: "completed", review: completed, aprArgs: [] };
  }
  if (inPilot(record) && completed) {
    return { decision: "blocked", reasons: ["opinion-already-completed"], reuse: false, outcome: "completed", review: completed, aprArgs: ["--skip-review"] };
  }
  return { decision: "run", reasons: ["review-required"], reuse: false, outcome: "incomplete", aprArgs: [] };
}

function inPilot(record) {
  return header(record, "review_policy") === "conditional-v1" && !header(record, "pilot_exit");
}

function gitBasis(record, facts) {
  const base = header(record, "base_sha");
  if (!SHA.test(base)) throw new Error("base_sha must pin a full Git commit");
  git("merge-base", "--is-ancestor", base, "HEAD");
  const start = record.indexOf("\n## Contract\n");
  const end = start < 0 ? -1 : record.indexOf("\n## ", start + 1);
  const contract = start < 0 ? "" : record.slice(start + "\n## Contract\n".length, end < 0 ? undefined : end).trim();
  return {
    base, head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), contract,
    paths: git("diff", "--name-only", "--no-renames", "-z", base, "HEAD").split("\0").filter(Boolean),
    dirty: Boolean(git("status", "--porcelain")), facts,
  };
}

function sourceComplete(review, base) {
  if (review.status !== "completed" || !text(review.reviewer) || !text(review.model) ||
      !["claude", "codex"].includes(review.family) || review.base !== base ||
      !SHA.test(review.head) || !SHA.test(review.tree) || !ACCESS.every((key) => review.access?.[key] === true)) return false;
  try {
    git("merge-base", "--is-ancestor", base, review.head);
    git("merge-base", "--is-ancestor", review.head, "HEAD");
    return git("rev-parse", `${review.head}^{tree}`) === review.tree;
  } catch {
    return false;
  }
}

function completedReview(record) {
  const match = header(record, "autoreview").match(/^(claude|codex) (.+), tree ([0-9a-f]{40}), (clean|\d+ fixed)$/);
  return match ? { engine: match[1], model: match[2], tree: match[3], result: match[4] } : null;
}

function alreadyCompleted(basis, review) {
  return { ...decision("skip", ["opinion-already-completed"], basis), reviewedTree: review.tree, notRereviewed: review.tree !== basis.tree };
}

function decision(value, reasons, basis, configPaths = []) {
  return {
    decision: value, reasons, basis, aprArgs: value === "skip" ? ["--skip-review"] : [],
    prompt: value === "run" ? `Retained extra opinion: ${reasons.join(", ")}.${configPaths.length ? ` Changed configuration: ${configPaths.join(", ")}.` : ""} Review the pinned base through HEAD, prioritizing these triggers.` : "",
  };
}

function configurationPath(path) {
  return /(?:^|\/)(?:package\.json|(?:package-lock|npm-shrinkwrap)\.json|(?:pnpm-lock|pnpm-workspace)\.yaml|yarn\.lock|bun\.lockb?|deno\.(?:jsonc?|lock)|Cargo\.(?:toml|lock)|go\.(?:mod|sum|work)|pyproject\.toml|poetry\.lock|uv\.lock|Pipfile(?:\.lock)?|requirements[^/]*\.txt|Gemfile(?:\.lock)?|composer\.(?:json|lock)|pom\.xml|(?:build|settings)\.gradle(?:\.kts)?|gradle\.properties|gradlew(?:\.bat)?|[^/]+\.csproj|global\.json|NuGet\.Config|Package\.(?:swift|resolved)|Podfile(?:\.lock)?|\.tool-versions|\.node-version|\.nvmrc|\.python-version|\.ruby-version|\.java-version|rust-toolchain(?:\.toml)?|\.npmrc|\.yarnrc(?:\.yml)?|\.gitmodules|Dockerfile[^/]*|Containerfile[^/]*|(?:docker-)?compose[^/]*\.ya?ml|Makefile|GNUmakefile|CMakeLists\.txt|[^/]+\.cmake|(?:vite|vitest|webpack|rollup|babel|next|nuxt|svelte|astro|eslint|prettier|tsup)\.config\.[^/]+|tsconfig[^/]*\.json|\.babelrc[^/]*|\.gitlab-ci\.yml|Jenkinsfile|azure-pipelines\.ya?ml)$/i.test(path) ||
    /(?:^|\/)(?:\.github\/workflows|\.circleci|\.buildkite|\.devcontainer|gradle\/wrapper)\//i.test(path);
}

process.exitCode = main(process.argv.slice(2));
