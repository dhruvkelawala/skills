import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const morningPath = fileURLToPath(new URL("./morning.mjs", import.meta.url));
const fakeGhPath = fileURLToPath(new URL("../evals/fake-gh.mjs", import.meta.url));

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString().replace(/\.\d+Z$/, "Z");
const hoursAfter = (iso, hours) => new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z");

// Runs the morning script against a GitHub world served by the fake gh on PATH, with HOME holding the
// issue-to-pr run records this machine has and the report's repos.txt. With `at`, the script's clock reads that
// moment, in UTC.
function run(t, world, { runRecords = [], repos, at, args = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "day-morning-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "world.json"), JSON.stringify(world));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/bin/sh\nexec "${process.execPath}" "${fakeGhPath}" "$@"\n`);
  chmodSync(join(dir, "bin", "gh"), 0o755);
  for (const record of runRecords) {
    mkdirSync(join(dir, "home", ".agent", "issue-to-pr", record.split("/")[0]), { recursive: true });
    writeFileSync(join(dir, "home", ".agent", "issue-to-pr", `${record}.md`), "stage: implemented\n");
  }
  if (repos !== undefined) {
    mkdirSync(join(dir, "home", ".agent", "day"), { recursive: true });
    writeFileSync(join(dir, "home", ".agent", "day", "repos.txt"), repos);
  }
  const clock = [];
  if (at) {
    writeFileSync(join(dir, "clock.mjs"), `const Real = Date;
globalThis.Date = class extends Real {
  constructor(...a) { super(...(a.length ? a : [${Date.parse(at)}])); }
  static now() { return ${Date.parse(at)}; }
};
`);
    clock.push("--import", join(dir, "clock.mjs"));
  }
  const env = { ...process.env, HOME: join(dir, "home"), PATH: `${join(dir, "bin")}:${process.env.PATH}`, FAKE_GH_WORLD: join(dir, "world.json"), TZ: "UTC" };
  return spawnSync(process.execPath, [...clock, morningPath, ...args], { encoding: "utf8", env });
}

function morning(t, world, options) {
  const result = run(t, world, options);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const issue = (number, fields) => ({ number, title: `issue ${number}`, author: "maker", state: "open", labels: [], body: "", createdAt: daysAgo(30), ...fields });
const ready = (number, fields) => issue(number, { labels: ["ready-for-agent"], ...fields });
const pull = (number, fields) => ({ number, title: `pr ${number}`, author: "maker", state: "open", createdAt: daysAgo(30), updatedAt: daysAgo(1), ...fields });

test("builds to start are ready, unblocked, unstarted issues in your repos or involving you, ranked by what they unblock, the repo pushed to last, then oldest", (t) => {
  const [d2, d5, d10, d30] = [daysAgo(2), daysAgo(5), daysAgo(10), daysAgo(30)];
  const { builds } = morning(t, {
    me: "maker",
    repos: {
      "maker/app": {
        pushedAt: daysAgo(3),
        issues: [
          ready(1, { createdAt: d10 }),
          ready(2, { createdAt: d2, blocking: 2 }),
          ready(3, { blockedBy: 1 }),
          ready(4),
          ready(5),
          ready(6, { state: "closed" }),
          issue(7),
          ready(8, { author: "outsider", createdAt: d30 }),
        ],
        pulls: [pull(50, { body: "Adds the thing. Closes #4." }), pull(51, { body: "Fixes #12, which looks like #1 but isn't." })],
      },
      "team/svc": {
        pushedAt: daysAgo(1),
        issues: [ready(40, { author: "teammate", involves: ["maker"], createdAt: d5 }), ready(41, { author: "teammate" })],
      },
      "maker/old": { archived: true, issues: [ready(9)] },
    },
  }, { runRecords: ["app/5"] });
  assert.deepEqual(builds, [
    { repo: "maker/app", number: 2, url: "https://github.com/maker/app/issues/2", title: "issue 2", blocking: 2, createdAt: d2 },
    { repo: "team/svc", number: 40, url: "https://github.com/team/svc/issues/40", title: "issue 40", blocking: 0, createdAt: d5 },
    { repo: "maker/app", number: 8, url: "https://github.com/maker/app/issues/8", title: "issue 8", blocking: 0, createdAt: d30 },
    { repo: "maker/app", number: 1, url: "https://github.com/maker/app/issues/1", title: "issue 1", blocking: 0, createdAt: d10 },
  ]);
});

test("almost ready lists open unlabelled issues with ticket's What's missing section, and its gaps", (t) => {
  const missing = "## What to build\n\nOnboarding drop-off.\n\n## What's missing\n- which screen loses people\r\n- no metric to check a fix against\n\n## In scope\n\nsrc/onboarding/\n";
  const { almostReady } = morning(t, {
    me: "maker",
    repos: {
      "maker/app": {
        issues: [
          issue(10, { body: missing }),
          issue(11, { body: "A test is missing for the empty case." }),
          ready(12, { body: missing }),
          issue(13, { body: missing, state: "closed" }),
        ],
      },
      "maker/old": { archived: true, issues: [issue(14, { body: missing })] },
    },
  });
  assert.deepEqual(almostReady, [
    { repo: "maker/app", number: 10, url: "https://github.com/maker/app/issues/10", title: "issue 10", missing: ["which screen loses people", "no metric to check a fix against"] },
  ]);
});

test("going stale lists your open PRs with no update for 14 days, the one that went quiet last first", (t) => {
  const [d15, d20] = [daysAgo(15), daysAgo(20.5)];
  const { stale } = morning(t, {
    me: "maker",
    repos: {
      "maker/app": {
        pulls: [
          pull(20, { updatedAt: d15, draft: true }),
          pull(21, { updatedAt: d20 }),
          pull(22, { updatedAt: daysAgo(13) }),
          pull(23, { updatedAt: daysAgo(30), author: "teammate" }),
          pull(24, { updatedAt: daysAgo(30), state: "merged", mergedAt: daysAgo(30) }),
        ],
      },
      "maker/old": { archived: true, pulls: [pull(25, { updatedAt: daysAgo(40) })] },
    },
  });
  assert.deepEqual(stale, [
    { repo: "maker/app", number: 20, url: "https://github.com/maker/app/pull/20", title: "pr 20", draft: true, updatedAt: d15, quietDays: 15 },
    { repo: "maker/app", number: 21, url: "https://github.com/maker/app/pull/21", title: "pr 21", draft: false, updatedAt: d20, quietDays: 20 },
  ]);
});

test("your open PRs are the ones updated in the last 14 days, updated last first, with their newest checks, review and conflicts", (t) => {
  const [h2, d1, d3, d5, d9] = [daysAgo(2 / 24), daysAgo(1), daysAgo(3), daysAgo(5), daysAgo(9)];
  const ci = (conclusion) => ({ name: `ci-${conclusion}`, status: "completed", conclusion });
  const { active } = morning(t, {
    me: "maker",
    repos: {
      "maker/app": {
        pulls: [
          pull(60, {
            updatedAt: d1, conflicts: true,
            checks: [ci("success"), { name: "lint", status: "in_progress" }, ci("failure")],
            reviews: [
              { author: "alice", at: d3, state: "CHANGES_REQUESTED", body: "Split this." },
              { author: "dave", at: d3, state: "APPROVED", body: "" },
              { author: "alice", at: d1, state: "COMMENTED", body: "Thanks." },
            ],
          }),
          pull(61, {
            updatedAt: h2,
            checks: [ci("success"), { name: "e2e", status: "queued" }],
            reviews: [{ author: "bob", at: d3, state: "CHANGES_REQUESTED", body: "" }, { author: "bob", at: d1, state: "APPROVED", body: "" }],
          }),
          pull(62, { updatedAt: d3, draft: true, reviewers: ["carol"] }),
          pull(63, {
            updatedAt: d5,
            checks: [{ name: "review", status: "completed", conclusion: "cancelled" }, ci("success"), ci("skipped"), ci("neutral"), { name: "review", status: "completed", conclusion: "success" }],
            statuses: [{ context: "deploy", state: "success" }],
          }),
          pull(64, { updatedAt: d9, checks: [ci("success")], statuses: [{ context: "deploy", state: "error" }] }),
          pull(65, { updatedAt: daysAgo(15) }),
          pull(66, { updatedAt: d1, author: "teammate" }),
        ],
      },
    },
  });
  const line = (number, updatedAt, standing, draft = false) => ({ repo: "maker/app", number, url: `https://github.com/maker/app/pull/${number}`, title: `pr ${number}`, draft, updatedAt, ...standing });
  assert.deepEqual(active, [
    line(61, h2, { checks: "pending", review: "approved", conflicts: false }),
    line(60, d1, { checks: "failing", review: "changes requested", conflicts: true }),
    line(62, d3, { checks: "none", review: "requested", conflicts: false }, true),
    line(63, d5, { checks: "passing", review: "none", conflicts: false }),
    line(64, d9, { checks: "failing", review: "none", conflicts: false }),
  ]);
});

test("when repos.txt names repositories, every list holds only theirs", (t) => {
  const missing = "## What's missing\n- which screen loses people\n";
  const merged = daysAgo(2);
  const repo = (name) => ({
    issues: [ready(1), issue(2, { body: missing })],
    pulls: [
      pull(3, { updatedAt: daysAgo(1) }),
      pull(4, { updatedAt: daysAgo(20) }),
      pull(5, { state: "merged", mergedAt: merged, updatedAt: hoursAfter(merged, 1), comments: [{ author: "alice", at: hoursAfter(merged, 1), body: `${name} breaks.` }] }),
    ],
  });
  const world = { me: "maker", repos: { "maker/app": repo("app"), "maker/web": repo("web"), "maker/dropped": repo("dropped") } };
  const lists = morning(t, world, { repos: "# what the report tracks\nMaker/App\n\nmaker/web   # the site\n" });
  for (const [name, items] of Object.entries(lists)) assert.deepEqual(items.map((i) => i.repo), ["maker/app", "maker/web"], `${name} lists ${items.map((i) => i.repo)}`);
});

// The report filters pr-review's queue by --repos, so it must print the same repositories the lists keep.
test("a repository marked weekdays counts Monday to Friday and is left out on Saturday and Sunday", (t) => {
  const world = { me: "maker", repos: { "maker/work": { issues: [ready(1)] }, "maker/side": { issues: [ready(2)] } } };
  const repos = "maker/work weekdays\nmaker/side\n";
  for (const [at, kept] of [
    ["2026-10-30T23:30:00Z", ["maker/work", "maker/side"]],
    ["2026-10-31T10:00:00Z", ["maker/side"]],
    ["2026-11-01T23:30:00Z", ["maker/side"]],
    ["2026-11-02T00:30:00Z", ["maker/work", "maker/side"]],
  ]) {
    assert.deepEqual(morning(t, world, { repos, at }).builds.map((b) => b.repo).sort(), [...kept].sort(), `builds at ${at}`);
    assert.deepEqual(morning(t, world, { repos, at, args: ["--repos"] }), kept, `--repos at ${at}`);
  }
  assert.equal(morning(t, world, { args: ["--repos"] }), null, "--repos with no repos.txt");
});

test("a repos.txt line that is not owner/name, optionally followed by weekdays, exits 2 and names the line", (t) => {
  const result = run(t, { me: "maker", repos: {} }, { repos: "maker/app weekday\n" });
  assert.equal(result.status, 2, result.stdout);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^morning: .*repos\.txt: "maker\/app weekday" is not owner\/name/m);
});

test("late comments are what people and review bots wrote on your PRs after they merged in the last 7 days, newest first", (t) => {
  const merged30 = daysAgo(3);
  const merged31 = daysAgo(2);
  const { lateComments } = morning(t, {
    me: "maker",
    repos: {
      "maker/app": {
        pulls: [
          pull(30, {
            state: "merged", mergedAt: merged30, updatedAt: hoursAfter(merged30, 5),
            comments: [
              { author: "alice", at: hoursAfter(merged30, -1), body: "Looks good." },
              { author: "alice", at: hoursAfter(merged30, 4), body: "This breaks   the empty\ncase on main." },
              { author: "maker", at: hoursAfter(merged30, 5), body: "On it." },
              { author: "deploy-bot[bot]", at: hoursAfter(merged30, 4.5), body: "Deployed to staging." },
            ],
          }),
          pull(31, {
            state: "merged", mergedAt: merged31, updatedAt: hoursAfter(merged31, 2),
            reviewComments: [{ author: "review-bot[bot]", at: hoursAfter(merged31, 1), body: "P1: the retry never stops." }],
            reviews: [
              { author: "carol", at: hoursAfter(merged31, 2), state: "COMMENTED", body: "Please add a test." },
              { author: "carol", at: hoursAfter(merged31, 2), state: "COMMENTED", body: "" },
            ],
          }),
          pull(32, { state: "merged", mergedAt: daysAgo(10), updatedAt: daysAgo(1), comments: [{ author: "alice", at: daysAgo(1), body: "Old one." }] }),
          pull(33, { state: "merged", mergedAt: daysAgo(1), updatedAt: hoursAfter(daysAgo(1), 0.001) }),
          pull(34, { author: "teammate", state: "merged", mergedAt: daysAgo(1), updatedAt: daysAgo(0.5), comments: [{ author: "alice", at: daysAgo(0.5), body: "Not yours." }] }),
        ],
      },
    },
  });
  assert.deepEqual(lateComments, [
    {
      repo: "maker/app", number: 31, url: "https://github.com/maker/app/pull/31", title: "pr 31", mergedAt: merged31,
      comments: [
        { author: "review-bot[bot]", at: hoursAfter(merged31, 1), url: "https://github.com/maker/app/pull/31#comment-1", body: "P1: the retry never stops." },
        { author: "carol", at: hoursAfter(merged31, 2), url: "https://github.com/maker/app/pull/31#review-1", body: "Please add a test." },
      ],
    },
    {
      repo: "maker/app", number: 30, url: "https://github.com/maker/app/pull/30", title: "pr 30", mergedAt: merged30,
      comments: [{ author: "alice", at: hoursAfter(merged30, 4), url: "https://github.com/maker/app/pull/30#comment-2", body: "This breaks the empty case on main." }],
    },
  ]);
});

// The report puts one line with the error in place of the four lists, so a failed read must not look like empty ones.
test("a GitHub read that fails exits 2 with the error and prints no lists", (t) => {
  const result = run(t, { me: "maker", repos: { "maker/app": { gone: true, issues: [ready(1)] } } });
  assert.equal(result.status, 2, result.stdout);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^morning: .*HTTP 404/m);
});
