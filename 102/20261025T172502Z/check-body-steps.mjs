// Lists each issue-to-pr step that publishes or refreshes a PR body (a line naming `--body-file`
// for a body), and whether that step or an earlier one in its section runs the body check.
import { execFileSync } from "node:child_process";
const [rev] = process.argv.slice(2);
const files = ["skills/issue-to-pr/SKILL.md", ...execFileSync("git", ["ls-tree", "--name-only", rev, "skills/issue-to-pr/references/"], { encoding: "utf8" }).trim().split("\n")];
const CHECK = /pr-body\.mjs|#the-check/;
const PUBLISH = /--body-file|gh pr create/;
let unchecked = 0;
for (const file of files) {
  const lines = execFileSync("git", ["show", `${rev}:${file}`], { encoding: "utf8" }).split("\n");
  let checkedInSection = false;
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{1,3} /.test(line)) checkedInSection = /^## The check/.test(line);
    if (CHECK.test(line)) checkedInSection = true;
    if (!PUBLISH.test(line) || inFence || /--add-reviewer|--base <default/.test(line) && !/--body-file/.test(line)) return;
    // stacks.md describes how apr opens a layer; stage 5 reaches it at step 3, after step 1's check.
    const viaStage5 = file.endsWith("stacks.md") && /gh pr create/.test(line);
    const ok = checkedInSection || viaStage5;
    if (!ok) unchecked++;
    console.log(`${ok ? "checked  " : "UNCHECKED"} ${file.replace("skills/issue-to-pr/", "")}:${i + 1}  ${line.trim().slice(0, 90)}`);
  });
}
console.log(`${unchecked} body publish or refresh step(s) with no body check before them`);
