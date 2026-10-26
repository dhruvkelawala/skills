#!/usr/bin/env node
// The PR body check. issue-to-pr runs it on every body before `gh pr create` and before each
// `gh pr edit --body-file`, so the top tier stays a two-minute read. references/pr-body.md has the
// template.
//
//   pr-body.mjs < body.md
//
// The top tier is everything above the first <details>, or the whole body when it has none. It is
// refused for more than 400 words, not counting image markup and URLs, and for a backticked commit
// SHA. An image whose alt text is its file name, or `<file> @ <sha>`, and a secret, such as a token in
// a captured request, are refused wherever they sit. Each problem prints on its own line, naming the
// body's line, and the exit code is 1.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describeSecret, findSecrets } from "../../pr-watch/scripts/secrets.mjs";

const USAGE = "usage: pr-body.mjs < body.md";
const TOP_WORDS = 400;
const FENCE = /^\s*(`{3,}|~{3,})/;
const DETAILS = /^\s*<details\b/i;
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const INLINE_CODE = /`([^`\n]+)`/g;
// A short or full SHA, or a range of two, with at least one letter so a plain number is not one.
const SHA = /^(?=.*[a-f])[0-9a-f]{7,40}(?:\.{2,3}[0-9a-f]{7,40})?$/i;
const FILE_AT_COMMIT = /\s@\s*`?[0-9a-f]{7,40}`?$/i;
// One word with a media extension, or the name macOS or the iOS Simulator gives a capture.
const MEDIA_FILE = /^(?:\S+|(?:Screenshot|Screen Shot|Screen Recording|Simulator Screen(?:shot| Recording))\b.*)\.(?:png|jpe?g|gif|webp|svg|avif|heic|mp4|mov|webm)$/i;

function checkBody(body) {
  const lines = linesOf(body);
  const top = lines.filter((line) => line.top);
  const count = top.reduce((sum, line) => sum + wordsIn(line.text), 0);
  const words = `${count} words ${top.length < lines.length ? "above the first <details>" : "in a body with no <details>"}`;
  const secrets = findSecrets(body).map((secret) => ({ line: secret.line, text: describeSecret(secret) }));
  const problems = [...wordProblems(top, words), ...top.flatMap(shaProblems), ...lines.flatMap(altProblems), ...secrets]
    .sort((a, b) => a.line - b.line)
    .map(({ line, text }) => `line ${line}: ${text}`);
  return { problems, words };
}

function linesOf(body) {
  let fence = "";
  let top = true;
  return body.split("\n").map((text, i) => {
    const marker = text.match(FENCE)?.[1] ?? "";
    const code = Boolean(fence || marker);
    if (fence) {
      if (marker[0] === fence[0] && marker.length >= fence.length && !text.trim().slice(marker.length).trim()) fence = "";
    } else if (marker) {
      fence = marker;
    } else if (DETAILS.test(text)) {
      top = false;
    }
    return { number: i + 1, text, code, top };
  });
}

function wordProblems(top, words) {
  let total = 0;
  const over = top.find((line) => (total += wordsIn(line.text)) > TOP_WORDS);
  if (!over) return [];
  return [{
    line: over.number,
    text: `the top tier reaches ${TOP_WORDS + 1} words here; it has ${words}, not counting images and URLs. Keep it to ${TOP_WORDS} by moving the rest into <details>`,
  }];
}

function wordsIn(text) {
  return text
    .replace(MARKDOWN_IMAGE, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function shaProblems({ number, text, code }) {
  if (code) return [];
  return [...text.matchAll(INLINE_CODE)]
    .map(([, span]) => span.trim())
    .filter((span) => SHA.test(span))
    .map((sha) => ({ line: number, text: `\`${sha}\` is a commit SHA above the first <details>; name commits in Verification, inside <details>` }));
}

function altProblems({ number, text, code }) {
  if (code) return [];
  const images = [
    ...[...text.matchAll(MARKDOWN_IMAGE)].map(([, alt, src]) => ({ alt, src })),
    ...[...text.matchAll(HTML_IMAGE)].map(([tag]) => ({ alt: attribute(tag, "alt"), src: attribute(tag, "src") })),
  ];
  return images.flatMap(({ alt, src }) => {
    const said = alt.trim();
    const what = FILE_AT_COMMIT.test(said) ? "is a file name and a commit" : isFileName(said, src) ? "is its file name" : "";
    return what ? [{ line: number, text: `the image's alt text "${said}" ${what}; say what the reader sees in it` }] : [];
  });
}

function isFileName(alt, src) {
  if (MEDIA_FILE.test(alt)) return true;
  const file = fileOf(src).toLowerCase();
  return Boolean(alt) && [file, file.replace(/\.[^.]+$/, "")].includes(alt.toLowerCase());
}

function fileOf(src) {
  const name = src.replace(/[?#].*$/, "").split("/").at(-1) ?? "";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function attribute(tag, name) {
  const value = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return value ? value[1] ?? value[2] ?? value[3] : "";
}

function main(argv) {
  if (argv.length) {
    console.error(USAGE);
    return 2;
  }
  const { problems, words } = checkBody(readFileSync(0, "utf8"));
  if (problems.length) {
    console.error(`body refused:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    return 1;
  }
  console.log(`the body passes: ${words}`);
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
