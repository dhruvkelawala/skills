#!/usr/bin/env node
// What pr-watch has drafted for people and holds until the user says "post". Holding never
// touches GitHub; `post` is the only way a held item reaches a person.
//
//   held.mjs hold --file F --thread ID --reply-to COMMENT_ID --seen COMMENT_ID --to LOGIN --body-file PATH
//   held.mjs hold --file F --review ID --to LOGIN --body-file PATH
//   held.mjs hold --file F --rerequest LOGIN
//   held.mjs post --file F --repo owner/name --pr N --record PATH
//
// The file is a JSON list of items in the order they were held:
//   { kind: "reply", thread, replyTo, seen, to, body }   a reply in a review thread, then resolving it;
//                                                        seen is the thread's newest comment when drafted
//   { kind: "comment", review, to, body }                 a PR comment answering a written review
//   { kind: "rerequest", to }                             asking the person to review again
//   { kind: "resolve", thread, to }                       left by a post whose reply went out but whose
//                                                        resolve failed
// Holding again for the same thread, review or person replaces the earlier item.
//
// `post` sends the items in order and removes each from the file once GitHub accepts it, so a failed
// post can run again without sending anything twice. It appends one line per send to the run record.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = [
  "usage: held.mjs hold --file F --thread ID --reply-to COMMENT_ID --seen COMMENT_ID --to LOGIN --body-file PATH",
  "       held.mjs hold --file F --review ID --to LOGIN --body-file PATH",
  "       held.mjs hold --file F --rerequest LOGIN",
  "       held.mjs post --file F --repo owner/name --pr N --record PATH",
].join("\n");
const RESOLVE = "mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }";
const FLAGS = new Set(["file", "thread", "reply-to", "seen", "to", "body-file", "review", "rerequest", "repo", "pr", "record"]);

export function readHeld(file) {
  if (!existsSync(file)) return [];
  const items = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(items)) throw new Error(`${file} is not a list of held items`);
  return items;
}

function writeHeld(file, items) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`);
}

function keyOf(item) {
  if (item.thread) return `thread ${item.thread}`;
  if (item.review) return `review ${item.review}`;
  return `rerequest ${String(item.to).toLowerCase()}`;
}

function describe(item) {
  if (item.kind === "reply") return `reply to ${item.to} in thread ${item.thread}`;
  if (item.kind === "resolve") return `resolve of ${item.to}'s thread ${item.thread}`;
  if (item.kind === "comment") return `comment to ${item.to} answering review ${item.review}`;
  return `review request to ${item.to}`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i].replace(/^--/, "");
    if (!rest[i].startsWith("--") || !FLAGS.has(flag)) throw new Error(`unknown argument: ${rest[i]}`);
    if (rest[i + 1] === undefined) throw new Error(`${rest[i]} requires a value`);
    args[flag] = rest[i + 1];
  }
  return args;
}

function itemFrom(args) {
  const required = (flag) => {
    if (!args[flag]) throw new Error(`--${flag} is required`);
    return args[flag];
  };
  const commentId = (flag) => {
    const id = Number(required(flag));
    if (!Number.isInteger(id) || id <= 0) throw new Error(`--${flag} expects a comment id, got "${args[flag]}"`);
    return id;
  };
  const body = () => readFileSync(required("body-file"), "utf8");
  const targets = ["thread", "review", "rerequest"].filter((flag) => args[flag] !== undefined);
  if (targets.length !== 1) throw new Error("hold needs exactly one of --thread, --review or --rerequest");
  if (args.thread) {
    return { kind: "reply", thread: args.thread, replyTo: commentId("reply-to"), seen: commentId("seen"), to: required("to"), body: body() };
  }
  if (args.review) return { kind: "comment", review: args.review, to: required("to"), body: body() };
  return { kind: "rerequest", to: required("rerequest") };
}

function post(file, args) {
  const repo = args.repo ?? "";
  if (!/^[^\s/]+\/[^\s/]+$/.test(repo)) throw new Error(`--repo must be owner/name, got "${repo}"`);
  const pr = Number(args.pr);
  if (!Number.isInteger(pr) || pr <= 0) throw new Error(`--pr expects a pull request number, got "${args.pr}"`);
  if (!args.record) throw new Error("--record is required");

  let items = readHeld(file);
  if (items.length === 0) {
    console.log("nothing held");
    return 0;
  }
  const sent = [];
  try {
    while (items.length > 0) {
      const [item, ...rest] = items;
      const { line, next } = send(`repos/${repo}`, pr, item);
      items = next ? [next, ...rest] : rest;
      writeHeld(file, items);
      sent.push(line);
      console.log(`sent ${line}`);
    }
  } catch (error) {
    throw new Error(`${describe(items[0])} was not sent: ${error.message}\n${items.length} item(s) still held`);
  } finally {
    if (sent.length > 0) {
      mkdirSync(dirname(args.record), { recursive: true });
      appendFileSync(args.record, `\nsent on "post" at ${new Date().toISOString()}\n${sent.map((l) => `- ${l}\n`).join("")}`);
    }
  }
  return 0;
}

// A reply leaves its thread's resolve as the next item, so the resolve can fail and be retried alone.
function send(repo, pr, item) {
  switch (item.kind) {
    case "reply": {
      const reply = write(`${repo}/pulls/${pr}/comments/${item.replyTo}/replies`, [`body=${item.body}`]);
      return { line: `reply to ${item.to}: ${reply.html_url}`, next: { kind: "resolve", thread: item.thread, to: item.to } };
    }
    case "resolve":
      write("graphql", [`query=${RESOLVE}`, `id=${item.thread}`]);
      return { line: `resolved ${item.to}'s thread ${item.thread}` };
    case "comment": {
      const comment = write(`${repo}/issues/${pr}/comments`, [`body=${item.body}`]);
      return { line: `comment to ${item.to}: ${comment.html_url}` };
    }
    case "rerequest":
      write(`${repo}/pulls/${pr}/requested_reviewers`, [`reviewers[]=${item.to}`]);
      return { line: `review re-requested from ${item.to}` };
    default:
      throw new Error(`unknown held item kind "${item.kind}"`);
  }
}

function write(endpoint, fields) {
  const args = ["api", "-X", "POST", endpoint, ...fields.flatMap((field) => ["-f", field])];
  try {
    return JSON.parse(execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) || "{}");
  } catch (error) {
    throw new Error(String(error.stderr || error.message).trim());
  }
}

async function main(argv) {
  try {
    const args = parseArgs(argv);
    const file = args.file ?? (() => { throw new Error("--file is required"); })();
    if (args.command === "post") return post(file, args);
    if (args.command !== "hold") throw new Error(USAGE);
    const item = itemFrom(args);
    const items = [...readHeld(file).filter((other) => keyOf(other) !== keyOf(item)), item];
    writeHeld(file, items);
    console.log(`held ${describe(item)}; ${items.length} item(s) wait for "post"`);
    return 0;
  } catch (error) {
    console.error(`held: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
