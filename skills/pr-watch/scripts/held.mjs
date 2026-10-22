#!/usr/bin/env node
// What pr-watch has drafted for people and holds until the user says "post". Holding never
// touches GitHub.
//
//   held.mjs hold --file F --thread ID --reply-to COMMENT_ID --seen COMMENT_ID --to LOGIN --body-file PATH
//   held.mjs hold --file F --review ID --to LOGIN --body-file PATH
//   held.mjs hold --file F --rerequest LOGIN
//
// The file is a JSON list of items in the order they were held:
//   { kind: "reply", thread, replyTo, seen, to, body }   a reply in a review thread, then resolving it;
//                                                        seen is the thread's newest comment when drafted
//   { kind: "comment", review, to, body }                 a PR comment answering a written review
//   { kind: "rerequest", to }                             asking the person to review again
// Holding again for the same thread, review or person replaces the earlier item.

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = [
  "usage: held.mjs hold --file F --thread ID --reply-to COMMENT_ID --seen COMMENT_ID --to LOGIN --body-file PATH",
  "       held.mjs hold --file F --review ID --to LOGIN --body-file PATH",
  "       held.mjs hold --file F --rerequest LOGIN",
].join("\n");
const FLAGS = new Set(["file", "thread", "reply-to", "seen", "to", "body-file", "review", "rerequest"]);

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

async function main(argv) {
  try {
    const args = parseArgs(argv);
    if (args.command !== "hold") throw new Error(USAGE);
    const file = args.file ?? (() => { throw new Error("--file is required"); })();
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
