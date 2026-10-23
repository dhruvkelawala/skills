// The world day's eval runs in, shared by the eval and its fake T3 server. The user, maker, owns maker/app:
// - three ready builds (#31 unblocks #35, so it ranks first; then #32, older than #33), #35 blocked by #31, and
//   #34 almost ready, missing two things;
// - two teammate PRs that ask for maker's review, #7 and a layer #5 stacked on it, so the queue starts at #7;
// - maker's own PR #20, quiet for 20 days, and no late comments, so that section is empty;
// - last night's record, with one run still stopped and one restarted since, and an older record from 3 days ago.
export const ME = "maker";
export const REPO = "maker/app";
export const REPO_URL = `https://github.com/${REPO}`;
export const PR = 7;
export const LAYER = 5;
export const PR_HEAD = "7e57c0de7e57c0de7e57c0de7e57c0de7e57c0de";
export const LAYER_HEAD = "5ca1ab1e5ca1ab1e5ca1ab1e5ca1ab1e5ca1ab1e";
export const BUILDS = [31, 32, 33];
export const PROJECT = { id: "project-app", title: "app" };
export const STOPPED = { threadId: "thread-stopped", title: "Build #12: cache layer" };
export const RESTARTED = { threadId: "thread-restarted", title: "Build #14: retry budget" };
export const OLD_STOP = { threadId: "thread-old", title: "Explain the cache" };
export const CONTINUED = { threadId: "thread-continued", title: "Build #15: export to JSON" };

const HOUR = 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

export function world(now) {
  const ago = (days) => iso(now - days * 24 * HOUR);
  const ready = (number, title, fields) => ({ number, title, author: ME, state: "open", labels: ["ready-for-agent"], body: `## What to build\n\n${title}.\n`, ...fields });
  return {
    me: ME,
    repos: {
      [REPO]: {
        defaultBranch: "main",
        pushedAt: ago(0.5),
        issues: [
          ready(31, "Rate-limit the export endpoint", { createdAt: ago(3), blocking: 1 }),
          ready(32, "Add a --dry-run flag to import", { createdAt: ago(9) }),
          ready(33, "Show the row count after export", { createdAt: ago(4) }),
          ready(35, "Per-team export quotas", { createdAt: ago(2), blockedBy: 1 }),
          {
            number: 34, title: "Onboarding loses people on step two", author: ME, state: "open", labels: [], createdAt: ago(1),
            body: "## What to build\n\nFind out why people drop off.\n\n## What's missing\n- which screen loses people\n- a metric to check a fix against\n",
          },
        ],
        pulls: [
          { number: PR, title: "Retry fetches on a 5xx", author: "teammate", requested: true, base: "main", head: "retry-on-5xx", sha: PR_HEAD, additions: 64, deletions: 3, files: 4, createdAt: ago(1), updatedAt: ago(0.4) },
          { number: LAYER, title: "Log each retry", author: "teammate", requested: true, base: "retry-on-5xx", head: "log-retries", sha: LAYER_HEAD, additions: 12, deletions: 0, files: 2, createdAt: ago(1), updatedAt: ago(0.4) },
          { number: 20, title: "Move the config loader to TOML", author: ME, base: "main", head: "toml-config", sha: "2020202020202020202020202020202020202020", createdAt: ago(25), updatedAt: ago(20) },
        ],
      },
    },
  };
}

// Night records as the goodnight check writes them: last night's, about 9 hours ago, and one from 3 days ago.
export function nightRecords(now) {
  const lastNight = now - 9 * HOUR;
  const older = now - 3 * 24 * HOUR;
  const name = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `night-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
  };
  const link = (t) => `[${t.title}](t3-thread://v1/${t.threadId})`;
  return [
    {
      name: name(lastNight),
      text: `# Night record, ${iso(lastNight)}

## Stopped
- ${iso(lastNight)} · ${link(STOPPED)} · PRs none · feat/12-cache-layer at 1a2b3c4, 0 uncommitted files · stopped at: stage 2, building criterion 2 of 3
- ${iso(lastNight)} · ${link(RESTARTED)} · PRs ${REPO_URL}/pull/9 · feat/14-retry-budget at 5d6e7f8, 2 uncommitted files · stopped at: stage 6, waiting on CI

## Continued
- ${iso(lastNight)} · ${link(CONTINUED)} · CI running, 7 repairs left
`,
    },
    {
      name: name(older),
      text: `# Night record, ${iso(older)}

## Stopped
- ${iso(older)} · ${link(OLD_STOP)} · PRs none · no git checkout · stopped at: reading the cache code
`,
    },
  ];
}

// Each thread's runs: the stopped one has not run since its stop, the restarted one was asked to go on this morning.
export function threadRuns(now) {
  const lastNight = now - 9 * HOUR;
  const run = (threadId, n, requestedMs, status) => ({ runId: `run:${threadId}:${n}`, ordinal: n, status, requestedAt: iso(requestedMs), startedAt: iso(requestedMs + 1000), completedAt: status === "running" ? null : iso(requestedMs + HOUR) });
  return {
    [STOPPED.threadId]: [run(STOPPED.threadId, 1, lastNight - 3 * HOUR, "interrupted")],
    [RESTARTED.threadId]: [run(RESTARTED.threadId, 2, now - 2 * HOUR, "running"), run(RESTARTED.threadId, 1, lastNight - 4 * HOUR, "interrupted")],
    [OLD_STOP.threadId]: [run(OLD_STOP.threadId, 1, now - 3 * 24 * HOUR - HOUR, "interrupted")],
    [CONTINUED.threadId]: [run(CONTINUED.threadId, 1, lastNight - 5 * HOUR, "completed")],
  };
}
