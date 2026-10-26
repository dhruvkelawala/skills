#!/usr/bin/env node
// Secrets in text about to reach GitHub in the user's name: a PR body, a comment or a reply.
// held.mjs refuses a draft that holds one, issue-to-pr's pr-body.mjs refuses a body, and pr-watch and
// apr run this on what they post directly.
//
//   secrets.mjs < text.md
//
// Each finding prints with its line and the kind of secret, never the secret itself, and the exit
// code is 1. Only shapes that are secrets on sight count, so a placeholder such as `$API_TOKEN`,
// `<token>` or `***` passes, and so does a password in a URL to this machine.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const USAGE = "usage: secrets.mjs < text.md";
const SHAPES = [
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ["an Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{40,}/],
  ["an OpenAI API key", /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})/],
  ["an AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{35}/],
  ["a Slack token", /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ["a Slack webhook", /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/],
  ["a Stripe secret key", /\b[rs]k_live_[A-Za-z0-9]{20,}/],
  ["a JSON web token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  // A token after `Bearer`, unless it is a placeholder: a variable, a <tag>, or ALL_CAPS words.
  ["a bearer token", /\b[Bb]earer\s+(?![$<{]|[A-Z_]+\b)[A-Za-z0-9._~+/-]{20,}/],
  // A password, unless it is a placeholder or the whole host is this machine's (not localhost.example.com).
  ["a password in a URL", /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:(?![$<{*])[^\s:/@]+@(?!(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?![\w.-]))/i],
];

// Every secret in `text` as { line, kind }, one per kind per line.
export function findSecrets(text) {
  return text.split("\n").flatMap((line, i) => SHAPES.filter(([, shape]) => shape.test(line)).map(([kind]) => ({ line: i + 1, kind })));
}

export function describeSecret({ kind }) {
  return `${kind}; put its variable's name, such as $API_TOKEN, in its place`;
}

function main(argv) {
  if (argv.length) {
    console.error(USAGE);
    return 2;
  }
  const found = findSecrets(readFileSync(0, "utf8"));
  if (found.length) {
    console.error(`secrets found:\n${found.map((secret) => `- line ${secret.line}: ${describeSecret(secret)}`).join("\n")}`);
    return 1;
  }
  console.log("no secrets found");
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
