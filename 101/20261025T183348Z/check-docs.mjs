// Scratch checker for criterion 5, never committed: reads the evidence skill's SKILL.md and
// references/surfaces.md at a revision and says whether they describe when and how to mark.
import { execFileSync } from "node:child_process";
const rev = process.argv[2] ?? "HEAD";
const show = (path) => execFileSync("git", ["show", `${rev}:${path}`], { encoding: "utf8" });
const skill = show("skills/evidence/SKILL.md");
const surfaces = show("skills/evidence/references/surfaces.md");
const checks = [
  ["SKILL.md says when to mark, pointing to the pr skill's Evidence rule", /mark/i.test(skill) && /`pr` skill's Evidence/.test(skill) && /hard to spot/.test(skill)],
  ["SKILL.md names scripts/mark.mjs", skill.includes("scripts/mark.mjs")],
  ["surfaces.md has a section on marking a pair", /^## Marking a before and after pair$/m.test(surfaces)],
  ["surfaces.md gives the mark.mjs command", /node <skill-dir>\/scripts\/mark\.mjs /.test(surfaces)],
  ["surfaces.md no longer offers ffmpeg hstack", !surfaces.includes("hstack")],
  ["the EVIDENCE.md template points to the marking section rather than restating when to mark", (() => {
    const step = skill.split("\n").find((line) => line.startsWith("3. Capture a still")) ?? "";
    return step.includes("Marking a before and after pair") && !/more than one difference|hard to spot/.test(step);
  })()],
];
for (const [what, ok] of checks) console.log(`${ok ? "ok  " : "MISS"} ${what}`);
const missed = checks.filter(([, ok]) => !ok).length;
console.log(`${rev}: ${missed} of ${checks.length} missing`);
process.exitCode = missed ? 1 : 0;
