// Drives run.mjs through its command line. A run's agents are a fake claude on PATH, and its case is a scratch repo.
// From the repo root: node --test skills/verification-skill/evals/run.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = dirname(dirname(evalsDir));

const runner = (dir, args = [], env = process.env) => spawnSync(process.execPath, [join(dir, "run.mjs"), ...args], { encoding: "utf8", env });

// A copy of the skills this eval reads, so a test can add a case or a results file without touching the repo.
function scratchSkills() {
  const root = mkdtempSync(join(tmpdir(), "verification-skill-eval-test-"));
  cpSync(join(skillsDir, "verification-skill"), join(root, "skills", "verification-skill"), { recursive: true });
  cpSync(join(skillsDir, "evidence", "references", "surfaces.md"), join(root, "skills", "evidence", "references", "surfaces.md"));
  return { root, evals: join(root, "skills", "verification-skill", "evals") };
}

function writeCase(evals, name, lessons) {
  mkdirSync(join(evals, "cases"), { recursive: true });
  writeFileSync(
    join(evals, "cases", `${name}.md`),
    `# ${name}\n\n- Repo: acme/${name}\n- Checkout: /nowhere/${name}\n- Base: ${"a".repeat(40)}\n\n## Lessons\n\n${lessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n`,
  );
}

describe("cases", () => {
  test("lore and visaroy load, each lesson citing a commit or PR", () => {
    const { status, stdout, stderr } = runner(evalsDir);
    assert.equal(status, 0, stderr);
    assert.match(stdout, /^ {2}lore\b/m);
    assert.match(stdout, /^ {2}visaroy\b/m);
  });

  test("refuses a case with a lesson that cites no commit or PR", () => {
    const { evals } = scratchSkills();
    writeCase(evals, "uncited", ["Pin the toolchain (abb228b0).", "Wait for an element before measuring it.", "Kill the process group (#540)."]);
    const { status, stderr } = runner(evals, ["uncited"]);
    assert.equal(status, 2);
    assert.match(stderr, /lesson 2 cites no commit or PR/);
  });
});
