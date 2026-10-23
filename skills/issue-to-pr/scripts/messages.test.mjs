import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MESSAGES = fileURLToPath(new URL("./messages.mjs", import.meta.url));

const CRITERIA = [
  "The results screen shows the round's score.",
  "A round with no score shows a dash.",
];

// A directory of run records for one repo, as ~/.agent/issue-to-pr/<repo>/ holds them. Each record
// has a header and a contract with CRITERIA, the way stage 1 writes it. A record given a `pr` has
// been published, with its `head` and, once stage 7 checked it, its `guide`.
function runRecords(t) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-messages-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const record = (issue, { predecessor, criteria = CRITERIA, pr, head, guide } = {}) => {
    const path = join(dir, `${issue}.md`);
    writeFileSync(path, [
      `issue: https://github.com/o/r/issues/${issue}`,
      `mode: ${predecessor ? "stacked" : "standalone"}`,
      ...(predecessor ? [`predecessor_pr: https://github.com/o/r/pull/${predecessor}`] : []),
      `stage: ${pr ? "ready" : "contract"}`,
      ...(head ? [`head: ${head}`] : []),
      `pr: ${pr ?? "none"}`,
      ...(guide ? [`guide: ${guide}`] : []),
      "",
      "## Contract",
      "",
      "Acceptance criteria:",
      ...criteria.flatMap((criterion, i) => [`${i + 1}. ${criterion}`, "   surface: web. capture: a still of the results screen."]),
      "",
      "Human gate: none.",
      "",
    ].join("\n"));
    return path;
  };
  const run = (args, input) => spawnSync(process.execPath, [MESSAGES, ...args], { input, encoding: "utf8" });
  const refused = (kind, path, text, problem) => {
    const before = readFileSync(path, "utf8");
    const result = run([kind, path], text);
    assert.equal(result.status, 1, `expected a refusal, got: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, problem);
    assert.equal(readFileSync(path, "utf8"), before, "a refused message is not saved");
  };
  const saved = (kind, path, text) => {
    const result = run([kind, path], text);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(readFileSync(path, "utf8").includes(text), "the record holds the message word for word");
  };
  return { record, run, refused, saved };
}

function brief({ building = "Building #7: Show the score on the results screen", about = "Players finish a round and never see their score. The results screen should show it.", plan = CRITERIA, stackedOn = "none", signOff = "🎯 Scores, finally on screen" } = {}) {
  return [
    building,
    "",
    `What it's about: ${about}`,
    "",
    ...(plan ? ["Plan:", ...plan.map((step, i) => `  ${i + 1}. ${step}`), ""] : []),
    `Stacked on: ${stackedOn} · Lane: light`,
    "",
    signOff,
  ].join("\n");
}

// The six lines as SKILL.md's recap shows them, a markdown list so the thread keeps them apart.
const RECAP_LINES = [
  "- Built: the results screen shows the score, and a dash when there is none.",
  "- Review: pass 1 and autoreview clean, light lane.",
  "- Verifier: skipped, rule B doesn't apply: a two-way door, and no authority, data, money or switch.",
  "- Evidence: https://github.com/o/r/blob/evidence/7/score.png?raw=true",
  "- Couldn't check: the score on a real phone.",
  "- Next: review #9.",
];

function recap({ result = "#7 is ready for your review: https://github.com/o/r/pull/9", lines = RECAP_LINES, signOff = "🏁 Score shown, round over" } = {}) {
  return [...(result ? [result, ""] : []), ...lines, "", signOff].join("\n");
}

test("a brief that fits its record's contract is saved to the record", (t) => {
  const { record, saved } = runRecords(t);
  saved("brief", record(7), brief());
});

test("a brief with no plan is refused", (t) => {
  const { record, refused } = runRecords(t);
  refused("brief", record(7), brief({ plan: null }), /no plan/);
});

test("a plan must list each criterion once, in any build order", (t) => {
  const { record, refused, saved } = runRecords(t);
  const path = record(7);
  refused("brief", path, brief({ plan: [CRITERIA[0], "Add a leaderboard."] }),
    /missing criterion: A round with no score shows a dash[\s\S]*not a criterion: Add a leaderboard/);
  saved("brief", path, brief({ plan: [CRITERIA[1], CRITERIA[0]] }));
});

test("a plan quotes a criterion word for word, even one that names a local path or localhost", (t) => {
  const { record, saved } = runRecords(t);
  const criteria = ["The audit lists each worktree under ~/.t3/worktrees.", "No link in the answer points at localhost."];
  saved("brief", record(7, { criteria }), brief({ plan: criteria }));
});

test("a brief needs its heading, a short 'What it's about' and a Stacked on line that fits the record", (t) => {
  const { record, refused } = runRecords(t);
  refused("brief", record(7), brief({ building: "Score on the results screen" }), /Building #<n>: <issue title>/);
  refused("brief", record(7), brief({ about: "Players finish a round. They never see their score. The screen should show it." }),
    /What it's about.*3 sentences/);
  refused("brief", record(8, { predecessor: 5 }), brief(), /Stacked on.*#5/);
});

test("a sign-off starts with an emoji, stays under 12 words and gives no instructions", (t) => {
  const { record, refused, saved } = runRecords(t);
  const path = record(7);
  for (const [signOff, problem] of [
    ["Scores, finally on screen", /emoji/],
    ["🎯 one two three four five six seven eight nine ten eleven twelve", /12 words/],
    ["👋 Reply to redirect", /instruction/],
  ]) refused("brief", path, brief({ signOff }), problem);
  saved("brief", path, brief({ signOff: "🎯 one two three four five six seven eight nine ten eleven" }));
});

test("a sign-off used in the last 10 messages of the repo's run records is refused, an older one is not", (t) => {
  const { record, refused, saved } = runRecords(t);
  const [first, second] = [record(1), record(2)];
  for (let n = 1; n <= 11; n += 1) {
    const signOff = `🎲 Sign-off number ${n}`;
    const path = n <= 5 ? first : second;
    if (n % 2) saved("brief", path, brief({ signOff }));
    else saved("recap", path, recap({ signOff }));
  }
  const third = record(3);
  refused("brief", third, brief({ signOff: "🎲 Sign-off number 2" }), /last 10/);
  refused("recap", third, recap({ signOff: "🎲 sign-off number 10!" }), /last 10/);
  saved("brief", third, brief({ signOff: "🎲 Sign-off number 1" }));
});

test("a recap leads with the result, has its five lines in order, and links nothing local", (t) => {
  const { record, refused, saved } = runRecords(t);
  const path = record(7);
  refused("recap", path, recap({ result: null }), /result/);
  refused("recap", path, recap({ lines: RECAP_LINES.filter((line) => !line.includes("Couldn't check:")) }), /Couldn't check:/);
  refused("recap", path, recap({ lines: [RECAP_LINES[0], RECAP_LINES[2], RECAP_LINES[1], ...RECAP_LINES.slice(3)] }), /order/);
  for (const evidence of ["- Evidence: http://localhost:3000/results", "- Evidence: /Users/someone/shots/score.png", "- Evidence: ~/shots/score.png"]) {
    refused("recap", path, recap({ lines: RECAP_LINES.map((line) => (line.includes("Evidence:") ? evidence : line)) }), /local/);
  }
  saved("recap", path, recap());
  const prose = "- Couldn't check: the localhost preview, which a phone can't open.";
  saved("recap", path, recap({ lines: RECAP_LINES.map((line) => (line.includes("Couldn't check:") ? prose : line)), signOff: "📵 No localhost on a phone" }));
});

test("a recap's Verifier line gives the verdict and why the verifier ran, or that it was skipped and why", (t) => {
  const { record, refused, saved } = runRecords(t);
  const path = record(7);
  const verifier = (line, signOff) => recap({ lines: RECAP_LINES.map((l) => (l.includes("Verifier:") ? line : l)), signOff });
  refused("recap", path, recap({ lines: RECAP_LINES.filter((line) => !line.includes("Verifier:")) }), /no `Verifier:` line/);
  refused("recap", path, verifier("- Verifier: looked fine to me"), /PASS, PASS\+NOTES or FAIL, or `skipped`/);
  refused("recap", path, verifier("- Verifier: skipped"), /why/);
  saved("recap", path, verifier("- Verifier: PASS+NOTES, rule B: the PR changes who may delete a project.", "🔐 Checked by fresh eyes"));
  saved("recap", path, verifier("- Verifier: skipped, rule B doesn't apply: a two-way door, and no authority, data, money or switch.", "🚪 Two-way door, no detour"));
});

test("once the run has a PR, the recap's first line links it and points at a guide written for the head", (t) => {
  const { record, refused, saved } = runRecords(t);
  const pr = "https://github.com/o/r/pull/9";
  const head = "c0ffee1234567890c0ffee1234567890c0ffee12";
  const published = (guide) => record(7, { pr, head, guide });
  const toGuide = "#7 is ready for your review: https://github.com/o/r/pull/9. The tour is in the Guide tab.";
  refused("recap", published(`written for ${head}`), recap({ result: "#7 is ready for your review. The tour is in the Guide tab." }),
    /first line links the PR, https:\/\/github\.com\/o\/r\/pull\/9/);
  refused("recap", published(`written for ${head}`), recap({ result: "#7 is ready for your review: https://github.com/o/r/pull/9" }), /Guide tab/);
  refused("recap", published(), recap({ result: toGuide }), /no `guide:` line/);
  refused("recap", published("written for ba5eba11ba5eba11ba5eba11ba5eba11ba5eba11"), recap({ result: toGuide }),
    /guide is written for ba5eba1, but the head is c0ffee1/);
  saved("recap", published("written for c0ffee1"), recap({ result: toGuide, signOff: "🧭 The tour waits in its tab" }));
  saved("recap", published("none: review guides are off on this server"),
    recap({ result: "#7 is ready for your review: https://github.com/o/r/pull/9. Guides are off here, so there's no tour.", signOff: "🗺️ No map this time" }));
});

test("the taste-check page shows each record's latest brief and recap, in the order given", (t) => {
  const { record, run, saved } = runRecords(t);
  const [first, second] = [record(1), record(2)];
  saved("brief", first, brief({ signOff: "🥚 The first draft of the brief" }));
  saved("brief", first, brief({ building: "Building #1: Show the <score> on screen", signOff: "🐣 The brief that replaced it" }));
  saved("recap", first, recap({ signOff: "🐥 Hatched and shipped" }));
  saved("brief", second, brief({ signOff: "🚧 Still building this one" }));
  const third = record(3);
  saved("brief", third, brief({ building: "Building #3: [x](https://a/(https://autofocus/onfocus=globalThis.pwned=1//)", signOff: "🧨 A title that tries its luck" }));

  const page = run(["page", second, first, third]);
  assert.equal(page.status, 0, page.stderr);
  const html = page.stdout;
  assert.match(html, /^<!doctype html>/i);
  assert.ok(!html.includes("The first draft of the brief"), "an earlier brief gives way to the latest");
  const order = ["Still building this one", "no recap yet", "The brief that replaced it", "Hatched and shipped"].map((text) => html.indexOf(text));
  assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `each message, in order: ${order}`);
  assert.ok(html.includes("Show the &lt;score&gt; on screen"), "message text is escaped");
  const tags = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
  assert.deepEqual(tags.filter((tag) => !/^<a href="[^"]*">$/.test(tag)), [], "a link in message text becomes an anchor with an href and nothing else");
});
