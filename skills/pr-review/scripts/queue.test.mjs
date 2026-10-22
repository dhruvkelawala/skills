import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const queuePath = fileURLToPath(new URL("./queue.mjs", import.meta.url));

// A GitHub world for the gh on PATH: each repository's open PRs, which of them ask for the user's
// review, and the reviews on each. Search answers as GitHub does for `--review-requested=@me` and
// `--reviewed-by=@me`, and `--archived=false` drops archived repositories. REST's pull list has no
// size, so only a PR's own GET carries its additions and deletions.
function fixtureGitHub(t, repos) {
  const dir = mkdtempSync(join(tmpdir(), "pr-review-queue-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const worldPath = join(dir, "world.json");
  writeFileSync(worldPath, JSON.stringify({ me: "reviewer", repos }));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const { me, repos } = JSON.parse(fs.readFileSync(${JSON.stringify(worldPath)}, "utf8"));
const args = process.argv.slice(2).flatMap((a) => (/^--[\\w-]+=/.test(a) ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a]));
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const answer = (value) => { process.stdout.write(typeof value === "string" ? value + "\\n" : JSON.stringify(value)); process.exit(0); };
const pages = (items) => (args.includes("--slurp") ? [items] : items);
const fullName = (repo) => ({ full_name: repo, archived: repos[repo].archived });
const rest = (repo, p) => ({
  number: p.number, title: p.title, html_url: "https://github.com/" + repo + "/pull/" + p.number, draft: p.draft ?? false,
  user: { login: p.author }, base: { ref: p.base, repo: fullName(repo) }, head: { ref: p.head, sha: p.sha, repo: { full_name: p.fork ?? repo } },
});
if (args[0] === "api" && args[1] === "user") answer(flag("--jq") === ".login" ? me : { login: me });
if (args[0] === "search" && args[1] === "prs") {
  if (flag("--state") !== "open") throw new Error("the fake models open PRs only");
  const hits = Object.entries(repos)
    .filter(([, r]) => flag("--archived") !== "false" || !r.archived)
    .flatMap(([repo, r]) => r.prs.map((p) => [repo, p]))
    .filter(([, p]) => (flag("--review-requested") === "@me" && p.requested) || (flag("--reviewed-by") === "@me" && (p.reviews ?? []).some((v) => v.user === me)));
  answer(hits.map(([repo, p]) => ({
    number: p.number, title: p.title, url: "https://github.com/" + repo + "/pull/" + p.number, author: { login: p.author },
    isDraft: p.draft ?? false, repository: { name: repo.split("/")[1], nameWithOwner: repo },
  })));
}
const endpoint = (args.find((a) => a.startsWith("repos/")) ?? "").split("?")[0];
const [, owner, name, kind, number, sub] = endpoint.split("/");
const repo = owner + "/" + name;
if (args[0] === "api" && repos[repo] && kind === "pulls") {
  const p = repos[repo].prs.find((x) => x.number === Number(number));
  if (!number) answer(pages(repos[repo].prs.map((x) => rest(repo, x))));
  if (p && !sub) answer({ ...rest(repo, p), additions: p.additions, deletions: p.deletions, changed_files: p.files });
  if (p && sub === "reviews") answer(pages((p.reviews ?? []).map((v) => ({ user: { login: v.user }, state: v.state, commit_id: v.commit, submitted_at: v.at }))));
}
process.stderr.write("gh: Not Found (HTTP 404)\\n");
process.exit(1);
`, { mode: 0o755 });
  return () => {
    const run = spawnSync(process.execPath, [queuePath], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH } });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
}

const pr = (number, fields) => ({ number, title: `pr ${number}`, author: "teammate", base: "main", head: `b${number}`, sha: `h${number}`, additions: 10, deletions: 0, files: 1, ...fields });
const reviewed = (commit) => ({ user: "reviewer", state: "COMMENTED", commit, at: "2026-10-20T10:00:00Z" });

test("orders return visits, then stack bottoms, then what unblocks the most, then the smallest", (t) => {
  const queue = fixtureGitHub(t, {
    "acme/app": {
      archived: false,
      prs: [
        pr(10, { requested: true, additions: 250, deletions: 50 }),
        pr(12, { requested: true, base: "b11", additions: 20 }),
        pr(13, { requested: true, additions: 30, deletions: 10, files: 2 }),
        pr(11, { requested: true, additions: 500 }),
        pr(14, { additions: 900, sha: "new14", reviews: [reviewed("old14")] }),
        pr(18, { author: "reviewer", base: "b12" }),
      ],
    },
  });
  const order = queue();
  assert.deepEqual(order.map((p) => p.number), [14, 11, 13, 10, 12]);
  assert.deepEqual(order[2], {
    repo: "acme/app", number: 13, url: "https://github.com/acme/app/pull/13", title: "pr 13", author: "teammate",
    base: "main", head: "h13", size: 40, files: 2, returnVisit: false, stackBottom: true, unblocks: 0,
  });
  assert.deepEqual(order.map((p) => [p.number, p.returnVisit, p.stackBottom, p.unblocks]), [
    [14, true, true, 0], [11, false, true, 2], [13, false, true, 0], [10, false, true, 0], [12, false, false, 1],
  ]);
});

test("leaves out drafts, the user's own PRs, archived repositories, and a PR reviewed at its head that nobody re-requested", (t) => {
  const queue = fixtureGitHub(t, {
    "acme/app": {
      archived: false,
      prs: [
        pr(20, { requested: true, draft: true }),
        pr(21, { author: "reviewer", reviews: [reviewed("h21")] }),
        pr(22, { reviews: [reviewed("h22")] }),
        pr(24, { requested: true }),
        pr(25, { requested: true, reviews: [reviewed("h25")] }),
      ],
    },
    "acme/old": { archived: true, prs: [pr(23, { requested: true })] },
  });
  assert.deepEqual(queue().map((p) => `${p.repo}#${p.number}`), ["acme/app#25", "acme/app#24"]);
});
