// The teammate's PR the eval reviews, and what each faked reviewer reports on it.
// Every finding is true of the code and line it names, so an agent that checks it against the code keeps it.

export const OWNER = "acme";
export const REPO = "demo";
export const PR = 7;
export const ISSUE = 6;
export const AUTHOR = "teammate";
export const USER = "reviewer";
export const PR_URL = `https://github.com/${OWNER}/${REPO}/pull/${PR}`;
export const HEAD_BRANCH = "retry-get";

export const BASE_FILES = {
  "package.json": `{ "name": "demo", "type": "module", "scripts": { "test": "node --test" } }\n`,
  "README.md": "# demo\n\nA small client for the demo service.\n",
  "src/client.js": `// Thin HTTP client for the demo service.
export async function fetchJson(url, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(\`GET \${url}: \${res.status}\`);
  return res.json();
}
`,
};

export const PR_COMMITS = [
  {
    message: "feat: retry failed GET requests",
    files: {
      "src/retry.js": `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls fn until it succeeds, waiting delayMs before the first retry and twice as long before each next one.
export async function withRetry(fn, { retries, delayMs }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt + 1 === retries) throw err;
      await sleep(delayMs * 2 ** attempt);
    }
  }
}
`,
      "src/config.js": "export const retryCfg = { n: 3, ms: 200 };\n",
      "src/client.js": `// Thin HTTP client for the demo service.
import { retryCfg } from "./config.js";
import { withRetry } from "./retry.js";

export async function fetchJson(url, { fetchImpl = fetch } = {}) {
  return withRetry(async () => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(\`GET \${url}: \${res.status}\`);
    return res.json();
  }, { retries: retryCfg.ms, delayMs: retryCfg.n });
}
`,
      "test/retry.test.js": `import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/retry.js";

test("retries until the call succeeds", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error("flaky");
    return "ok";
  }, { retries: 3, delayMs: 1 });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});
`,
    },
  },
  {
    message: "docs: say that GET requests retry",
    files: {
      "README.md": "# demo\n\nA small client for the demo service.\n\nGET requests retry with backoff. `retryCfg` in `src/config.js` sets how many times and how long to wait.\n",
    },
  },
];

// The author's push that fixes both P1 findings and adds the missing test.
export const FIX_COMMIT = {
  message: "fix: retry count and the order of the retry settings",
  edit: {
    "src/retry.js": ["if (attempt + 1 === retries) throw err;", "if (attempt === retries) throw err;"],
    "src/client.js": ["{ retries: retryCfg.ms, delayMs: retryCfg.n }", "{ retries: retryCfg.n, delayMs: retryCfg.ms }"],
  },
  append: {
    "test/retry.test.js": `
test("retries: 0 makes one call", async () => {
  let calls = 0;
  await assert.rejects(withRetry(async () => {
    calls += 1;
    throw new Error("down");
  }, { retries: 0, delayMs: 1 }));
  assert.equal(calls, 1);
});
`,
  },
};

// The queue chain's second PR: a layer stacked on PR #7, smaller and with a lower number, so only the queue's
// stack-bottom rule puts #7 first.
export const LAYER = 5;
export const LAYER_BRANCH = "retry-log";
export const LAYER_URL = `https://github.com/${OWNER}/${REPO}/pull/${LAYER}`;
export const LAYER_TITLE = "Log each retry";
export const LAYER_BODY = `Stacked on #${PR}.

Each retry of a GET now writes one warning line, so a flaky dependency shows up in the logs.

**Door:** two-way. Reverting the PR removes the log line.
`;
export const LAYER_COMMITS = [
  {
    message: "feat: log each retry",
    files: {
      "src/log.js": `// One warning line per retry, so a flaky dependency shows up in the logs.
export function logRetry(url) {
  return (err, attempt) => console.warn(\`retry \${attempt + 1} of GET \${url}: \${err.message}\`);
}
`,
      "src/retry.js": `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls fn until it succeeds, waiting delayMs before the first retry and twice as long before each next one.
export async function withRetry(fn, { retries, delayMs, onRetry }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt + 1 === retries) throw err;
      onRetry?.(err, attempt);
      await sleep(delayMs * 2 ** attempt);
    }
  }
}
`,
      "src/client.js": `// Thin HTTP client for the demo service.
import { retryCfg } from "./config.js";
import { logRetry } from "./log.js";
import { withRetry } from "./retry.js";

export async function fetchJson(url, { fetchImpl = fetch } = {}) {
  return withRetry(async () => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(\`GET \${url}: \${res.status}\`);
    return res.json();
  }, { retries: retryCfg.ms, delayMs: retryCfg.n, onRetry: logRetry(url) });
}
`,
    },
  },
];

// Lands on main before the author rebases the PR onto it, in a file the PR does not touch.
export const MAIN_COMMIT = {
  message: "docs: name the service URL",
  files: { "docs/service.md": "# Service\n\nThe demo service runs at https://demo.example.com.\n" },
};

export const PR_TITLE = "Retry failed GET requests";
export const PR_BODY = `Closes #${ISSUE}.

GET requests now retry with exponential backoff through a small \`withRetry\` helper. The settings live in \`src/config.js\`.

**Door:** two-way. Reverting the PR removes retries.

Tested with \`node --test\`.
`;

export const ISSUE_TITLE = "Retry failed GET requests";
export const ISSUE_BODY = `\`fetchJson\` should retry a failed GET with exponential backoff, waiting 200 ms before the first retry.

## Acceptance criteria

- \`retries\` is how many times to retry after the first failure, 3 by default, so a GET makes at most 4 calls.
- \`retries: 0\` makes exactly one call.
- The delay doubles after each retry.
`;

const OFF_BY_ONE = {
  priority: "P1",
  file: "src/retry.js",
  line: 9,
  symbol: "withRetry",
  title: "Stops one call early, and never stops at `retries: 0`",
  body: "`attempt + 1 === retries` throws after `retries` calls, so `retries: 3` makes 3 calls where the issue allows 4, and with `retries: 0` the check is never true, so a failing GET retries forever. Issue #6: \"`retries: 0` makes exactly one call.\"",
};
const NO_LIMIT_TEST = {
  priority: "P2",
  file: "test/retry.test.js",
  line: 5,
  symbol: "retries until the call succeeds",
  title: "No test covers `retries: 0` or the call limit",
  body: "The only test retries a call that succeeds on its third try, which passes with or without the off-by-one in retry.js.",
};
const MYSTERIOUS_NAMES = {
  priority: "P2",
  file: "src/config.js",
  line: 1,
  symbol: "retryCfg",
  title: "Possible Mysterious Name: `retryCfg.n` and `retryCfg.ms`",
  body: "The names don't say which is the retry count and which is the delay. `retries` and `delayMs` would match withRetry's options.",
};
const SWAPPED_SETTINGS = {
  priority: "P1",
  file: "src/client.js",
  line: 10,
  symbol: "fetchJson",
  title: "Pass the retry settings in the right order",
  body: "`retries` gets `retryCfg.ms` (200) and `delayMs` gets `retryCfg.n` (3), so a failing GET is retried 200 times, starting 3 ms apart and doubling each time.",
};

// Findings per reviewer, by the PR's phase: "first" as opened (and after a pure rebase), "fixed" after FIX_COMMIT.
const REVIEWS = {
  spec: { first: [OFF_BY_ONE, NO_LIMIT_TEST], fixed: [] },
  standards: { first: [MYSTERIOUS_NAMES], fixed: [MYSTERIOUS_NAMES] },
  autoreview: { first: [SWAPPED_SETTINGS], fixed: [] },
};

export const findingsFor = (reviewer, phase) => REVIEWS[reviewer][phase === "fixed" ? "fixed" : "first"];
export const findingsAt = (phase) => Object.keys(REVIEWS).flatMap((r) => findingsFor(r, phase));
