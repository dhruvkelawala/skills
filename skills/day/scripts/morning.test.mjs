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
// issue-to-pr run records this machine has.
function morning(t, world, runRecords = []) {
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
  const env = { ...process.env, HOME: join(dir, "home"), PATH: `${join(dir, "bin")}:${process.env.PATH}`, FAKE_GH_WORLD: join(dir, "world.json") };
  const run = spawnSync(process.execPath, [morningPath], { encoding: "utf8", env });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
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
  }, ["app/5"]);
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
