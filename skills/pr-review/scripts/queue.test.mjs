import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const queuePath = fileURLToPath(new URL("./queue.mjs", import.meta.url));

// A GitHub world for the gh on PATH: each repository's open PRs, which of them ask for the user's
// review, and the reviews on each. Search answers as GitHub does for `--review-requested=@me`,
// `--reviewed-by=@me` and `--author=@me`, archived repositories included. REST's pull list has no
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
    .flatMap(([repo, r]) => r.prs.map((p) => [repo, p]))
    .filter(([, p]) => (flag("--review-requested") === "@me" && p.requested) || (flag("--reviewed-by") === "@me" && (p.reviews ?? []).some((v) => v.user === me)) ||
      (flag("--author") && p.author.toLowerCase() === (flag("--author") === "@me" ? me : flag("--author")).toLowerCase()) ||
      (flag("--updated") && p.updated >= flag("--updated").slice(2)));
  answer(hits.map(([repo, p]) => ({
    number: p.number, title: p.title, url: "https://github.com/" + repo + "/pull/" + p.number, author: { login: p.author },
    isDraft: p.draft ?? false, repository: { name: repo.split("/")[1], nameWithOwner: repo },
  })));
}
const endpoint = (args.find((a) => a.startsWith("repos/")) ?? "").split("?")[0];
const [, owner, name, kind, number, sub] = endpoint.split("/");
const repo = owner + "/" + name;
if (args[0] === "api" && repos[repo] && kind === "issues" && sub === "timeline") {
  const p = repos[repo].prs.find((x) => x.number === Number(number));
  if (p) answer(pages(p.events ?? []));
}
if (args[0] === "api" && repos[repo] && kind === "pulls") {
  const p = repos[repo].prs.find((x) => x.number === Number(number));
  if (!number) answer(pages(repos[repo].prs.map((x) => rest(repo, x))));
  if (p && !sub) answer({ ...rest(repo, p), additions: p.additions, deletions: p.deletions, changed_files: p.files });
  if (p && sub === "reviews") answer(pages((p.reviews ?? []).map((v) => ({ user: { login: v.user }, state: v.state, commit_id: v.commit, submitted_at: v.at }))));
}
process.stderr.write("gh: Not Found (HTTP 404)\\n");
process.exit(1);
`, { mode: 0o755 });
  return (...args) => {
    const run = spawnSync(process.execPath, [queuePath, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH } });
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

test("with --repo, lists only that repository's queue", (t) => {
  const queue = fixtureGitHub(t, {
    "acme/app": { archived: false, prs: [pr(30, { requested: true })] },
    "acme/lib": { archived: false, prs: [pr(31, { requested: true }), pr(32, { requested: true, base: "b31" })] },
  });
  assert.deepEqual(queue("--repo", "acme/lib").map((p) => `${p.repo}#${p.number}`), ["acme/lib#31", "acme/lib#32"]);
  assert.deepEqual(queue().map((p) => `${p.repo}#${p.number}`), ["acme/lib#31", "acme/app#30", "acme/lib#32"]);
});

test("with --mine, lists the user's own open PRs instead, even one they reviewed at its head", (t) => {
  const queue = fixtureGitHub(t, {
    "acme/app": {
      archived: false,
      prs: [
        pr(40, { requested: true }),
        pr(41, { author: "reviewer", additions: 300 }),
        pr(42, { author: "reviewer", base: "b41" }),
        pr(43, { author: "reviewer", reviews: [reviewed("h43")] }),
        pr(44, { author: "reviewer", draft: true }),
      ],
    },
    "acme/lib": { archived: false, prs: [pr(45, { author: "reviewer", additions: 50 })] },
    "acme/old": { archived: true, prs: [pr(46, { author: "reviewer" })] },
  });
  assert.deepEqual(queue("--mine").map((p) => `${p.repo}#${p.number}`), ["acme/app#43", "acme/app#41", "acme/lib#45", "acme/app#42"]);
  assert.deepEqual(queue("--mine", "--repo", "acme/lib").map((p) => `${p.repo}#${p.number}`), ["acme/lib#45"]);
});

test("with --author, finds that author's ready PRs without requiring a review request", (t) => {
  const queue = fixtureGitHub(t, {
    "acme/app": { archived: false, prs: [
      pr(50, { author: "Teammate", reviews: [reviewed("h50")] }),
      pr(51, { author: "teammate", draft: true }),
      pr(52, { author: "other", requested: true }),
      pr(53, { author: "reviewer" }),
    ] },
    "acme/lib": { archived: false, prs: [pr(54, {})] },
    "acme/old": { archived: true, prs: [pr(55, {})] },
  });
  assert.deepEqual(queue("--author", "teammate").map((p) => `${p.repo}#${p.number}`), ["acme/app#50", "acme/lib#54"]);
  assert.deepEqual(queue("--author", "TEAMMATE", "--repo", "acme/app").map((p) => p.number), [50]);
  assert.deepEqual(queue("--author", "reviewer", "--repo", "acme/app").map((p) => p.number), [53]);
});

test("with --ready-since, finds newly ready PRs and ignores unrelated updates and current drafts", (t) => {
  const before = "2026-11-18T08:59:59Z";
  const start = "2026-11-18T09:00:00Z";
  const after = "2026-11-18T09:01:00Z";
  const ready = (created_at) => ({ event: "ready_for_review", created_at });
  const queue = fixtureGitHub(t, {
    "acme/app": { archived: false, prs: [
      pr(60, { updated: after, events: [ready(after)] }),
      pr(61, { updated: after, events: [ready(before), { event: "commented", created_at: after }] }),
      pr(62, { updated: after, draft: true, events: [ready(after)] }),
      pr(63, { updated: after, author: "reviewer", events: [ready(after)] }),
      pr(64, { updated: after, author: "other", events: [ready(start)] }),
      pr(65, { events: [ready(before), ready(after)], reviews: [reviewed("h65")] }),
    ] },
    "acme/lib": { archived: false, prs: [pr(66, { updated: after, events: [ready(after)] })] },
    "acme/old": { archived: true, prs: [pr(67, { updated: after, events: [ready(after)] })] },
  });
  const recent = queue("--repo", "acme/app", "--ready-since", start);
  assert.deepEqual(recent.map((p) => p.number), [65, 60, 64]);
  assert.equal(recent.find((p) => p.number === 60).readyAt, after);
  assert.deepEqual(queue("--ready-since", start).map((p) => p.number), [60, 64, 66]);
  assert.deepEqual(queue("--repo", "acme/app", "--author", "teammate", "--ready-since", start).map((p) => p.number), [65, 60]);
  assert.deepEqual(queue("--repo", "acme/app", "--mine", "--ready-since", start).map((p) => p.number), [63]);
});

test("rejects conflicting selectors and an invalid readiness timestamp before contacting GitHub", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pr-review-args-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const args of [["--mine", "--author", "teammate"], ["--ready-since", "yesterday"], ["--ready-since", "2026-11-18"]]) {
    const run = spawnSync(process.execPath, [queuePath, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: dir } });
    assert.equal(run.status, 2, run.stderr);
    assert.match(run.stderr, /usage:/);
  }
});
