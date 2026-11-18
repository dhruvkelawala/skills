import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RESET = fileURLToPath(new URL("./reset.mjs", import.meta.url));
const HEADER = {
  issue: "https://github.com/o/r/issues/7",
  stage: "published",
  head: "a".repeat(40),
  repairs: "2/10",
  pr: "https://github.com/o/r/pull/8",
  draft: "no",
  land: "--merge",
};

// A run record at the end of stage 5, and the thread's session as a Claude transcript.
function run(t, header = HEADER, { firstRequest } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-reset-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const record = join(dir, "7.md");
  const write = (fields) => writeFileSync(record, Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n## Contract\n\nKeep this.\n");
  write(header);
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: "fresh-session", CLAUDE_CONFIG_DIR: join(dir, "claude") };
  delete env.CODEX_THREAD_ID;
  if (firstRequest) {
    mkdirSync(join(dir, "claude", "projects", "worktree"), { recursive: true });
    const lines = [
      { type: "user", message: { content: "resume" } },
      { type: "assistant", message: { usage: firstRequest } },
      { type: "assistant", message: { usage: { input_tokens: 9, cache_read_input_tokens: 900000, cache_creation_input_tokens: 9 } } },
    ];
    writeFileSync(join(dir, "claude", "projects", "worktree", "fresh-session.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  }
  return {
    record,
    text: () => readFileSync(record, "utf8"),
    edit: (fields) => {
      const current = Object.fromEntries(readFileSync(record, "utf8").split("\n\n")[0].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 2)]));
      write({ ...current, ...fields });
    },
    reset: (...args) => spawnSync(process.execPath, [RESET, ...args], { env, encoding: "utf8" }),
  };
}

test("a record the fresh context finds as the reset left it passes the after check without being written", (t) => {
  const r = run(t);
  assert.equal(r.reset("before", r.record).status, 0);
  const saved = r.text();
  assert.match(saved, /^reset: /m, "before saves its snapshot in the header");
  const after = r.reset("after", r.record);
  assert.equal(after.status, 0, after.stdout + after.stderr);
  assert.match(after.stdout, /stage published, repairs 2\/10, draft no, guide none, land --merge/);
  assert.equal(r.text(), saved, "after is read-only");
});

test("a field that moved across the reset fails the after check and names it", (t) => {
  for (const [field, value] of [["repairs", "3/10"], ["draft", "yes"], ["stage", "watching"], ["land", "dropped at " + "b".repeat(40) + ": the patch changed"], ["guide", "written for " + "a".repeat(40)]]) {
    const r = run(t);
    r.reset("before", r.record);
    r.edit({ [field]: value });
    const after = r.reset("after", r.record);
    assert.equal(after.status, 1, `${field}: ${after.stdout}`);
    assert.match(after.stdout, new RegExp(`${field}: .* before the reset, ${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} now`));
  }
});

test("a land held before the reset is lost when the line is gone afterwards", (t) => {
  const r = run(t);
  r.reset("before", r.record);
  writeFileSync(r.record, r.text().replace(/^land: .*\n/m, ""));
  const after = r.reset("after", r.record);
  assert.equal(after.status, 1);
  assert.match(after.stdout, /land: --merge before the reset, none now/);
});

test("a second reset of the same run is refused, so a fresh context never resets again", (t) => {
  const r = run(t);
  assert.equal(r.reset("before", r.record).status, 0);
  const once = r.text();
  const again = r.reset("before", r.record);
  assert.equal(again.status, 1);
  assert.match(again.stdout + again.stderr, /already reset/);
  assert.equal(r.text(), once);
});

test("after without a snapshot exits 2 instead of passing", (t) => {
  const r = run(t);
  const after = r.reset("after", r.record);
  assert.equal(after.status, 2);
  assert.match(after.stderr, /no reset snapshot/);
});

test("after reports the fresh session's first request against the 100k limit", (t) => {
  const within = run(t, HEADER, { firstRequest: { input_tokens: 2, cache_read_input_tokens: 29834, cache_creation_input_tokens: 37597 } });
  within.reset("before", within.record);
  assert.match(within.reset("after", within.record).stdout, /first request after the reset: 67433 input tokens, within the 100000 limit/);

  const over = run(t, HEADER, { firstRequest: { input_tokens: 1, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0 } });
  over.reset("before", over.record);
  const result = over.reset("after", over.record);
  assert.match(result.stdout, /first request after the reset: 150001 input tokens, over the 100000 limit/);
  assert.equal(result.status, 0, "the token count is reported, never a reason to fail the record check");

  const missing = run(t);
  missing.reset("before", missing.record);
  assert.match(missing.reset("after", missing.record).stdout, /first request after the reset: unavailable/);
});
