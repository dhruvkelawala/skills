import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./required-review.mjs", import.meta.url));

// Runs the script for o/r's branch main with a gh on PATH that answers as GitHub does. `ref` is the
// branch's rules in GraphQL's shape, as GitHub returned them for cli/cli and nodejs/node on
// 2026-10-23, or "spent" once the account's GraphQL quota is. `rulesets` and `protected` are what
// REST shows; `rulesets: "forbidden"` is a plan without rulesets. `broken` fails every call.
function requiredReview(t, github) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-required-review-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const github = ${JSON.stringify(github)};
const args = process.argv.slice(2);
const answer = (value) => { process.stdout.write(JSON.stringify(value)); process.exit(0); };
const fail = (message) => { process.stderr.write(message + "\\n"); process.exit(1); };
if (github.broken) fail("gh: " + github.broken);
if (args[0] === "api" && args[1] === "graphql") {
  if (github.ref === "spent") fail("gh: API rate limit already exceeded for user ID 1.");
  if (!["o=o", "n=r", "q=refs/heads/main"].every((field) => args.includes(field))) fail("unexpected query: " + args.join(" "));
  answer({ data: { repository: { ref: github.ref } } });
}
const endpoint = (args[1] ?? "").split("?")[0];
if (endpoint === "repos/o/r/rules/branches/main") {
  if (github.rulesets === "forbidden") fail("gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)");
  answer(github.rulesets ?? []);
}
if (endpoint === "repos/o/r/branches/main") answer({ name: "main", protected: Boolean(github.protected) });
fail("gh: Not Found (HTTP 404)");
`, { mode: 0o755 });
  return spawnSync(process.execPath, [SCRIPT, "o/r", "main"], {
    encoding: "utf8", env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}` },
  });
}

const ref = (refUpdateRule, nodes = []) => ({ refUpdateRule, rules: { nodes } });
const pullRequestRule = (count) => ({ type: "PULL_REQUEST", parameters: { requiredApprovingReviewCount: count } });

test("says how many approvals a branch's protection or rulesets ask for, through GraphQL or, with its quota spent, REST", (t) => {
  for (const [name, github, says] of [
    ["unprotected", { ref: ref(null) }, "no review required"],
    ["classic protection", { ref: ref({ requiredApprovingReviewCount: 1 }, [{ type: "COPILOT_CODE_REVIEW", parameters: {} }]) }, "review required: 1 approval"],
    ["a ruleset", { ref: ref({ requiredApprovingReviewCount: 0 }, [{ type: "DELETION", parameters: null }, pullRequestRule(1)]) }, "review required: 1 approval"],
    ["both, the higher count", { ref: ref({ requiredApprovingReviewCount: 2 }, [pullRequestRule(1)]) }, "review required: 2 approvals"],
    ["protection with no review rule", { ref: ref({ requiredApprovingReviewCount: 0 }, [{ type: "REQUIRED_LINEAR_HISTORY", parameters: null }]) }, "no review required"],
    ["quota spent, a ruleset", { ref: "spent", rulesets: [{ type: "pull_request", parameters: { required_approving_review_count: 2 } }] }, "review required: 2 approvals"],
    ["quota spent, a protected branch REST can't see into", { ref: "spent", protected: true }, "review required: 1 approval"],
    ["quota spent, unprotected on a plan without rulesets", { ref: "spent", rulesets: "forbidden" }, "no review required"],
  ]) {
    const run = requiredReview(t, github);
    assert.equal(run.status, 0, `${name}: ${run.stderr}`);
    assert.equal(run.stdout.trim(), says, name);
  }
});

test("a failed read of the branch rules exits 2 rather than reporting no review", (t) => {
  const run = requiredReview(t, { broken: "HTTP 401: Bad credentials (https://api.github.com/graphql)" });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /Bad credentials/);
});
