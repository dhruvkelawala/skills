#!/usr/bin/env node
// The cleanup once a PR has merged: the worktree that holds its branch, the local branch, and
// origin's branch. Nothing goes until GitHub says the PR merged, and whatever could lose work stays,
// with the reason: a checkout with uncommitted changes, a worktree with ignored files Git doesn't
// keep, such as a `.env`, or a branch with commits the PR never had.
//
//   after-merge.mjs <PR URL>
//
// It works from any checkout of the repository, the one it removes included. A linked worktree
// goes through `git worktree remove`, never forced. The main checkout stays and switches to the
// PR's base branch. Origin's branch is deleted only while it still points at the merged head, and
// GitHub then retargets any PR stacked on it. Exit 0 when everything went, 1 when something was
// kept, 2 when the PR hasn't merged or a command failed. GitHub is read through GraphQL or, with its
// quota spent, REST.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PR_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;
// The rebuildable output the cleanup skill's step 4 names: build output, and the hooks husky writes
// on install. Removing a worktree deletes its ignored files too, so any other ignored file keeps the
// worktree, unless it is a link out of the worktree.
const REBUILDABLE = ["node_modules", "target", ".next", ".turbo", ".husky/_"];

const run = (command, args) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const git = (cwd, ...args) => run("git", ["-C", cwd, ...args]);
const rateLimited = (error) => /rate limit|RATE_LIMITED/i.test(`${error?.stderr ?? ""}\n${error?.stdout ?? ""}`);
const short = (sha) => sha.slice(0, 7);

function readPr(url) {
  const [, owner, name, number] = url.match(PR_URL);
  try {
    const pr = JSON.parse(run("gh", ["pr", "view", url, "--json", "state,headRefName,headRefOid,baseRefName"]));
    return { state: pr.state, branch: pr.headRefName, head: pr.headRefOid, base: pr.baseRefName };
  } catch (error) {
    if (!rateLimited(error)) throw error;
  }
  const pr = JSON.parse(run("gh", ["api", `repos/${owner}/${name}/pulls/${number}`]));
  return { state: pr.merged ? "MERGED" : pr.state.toUpperCase(), branch: pr.head.ref, head: pr.head.sha, base: pr.base.ref };
}

// The main checkout comes first in git's list, then each linked worktree.
function worktrees() {
  return run("git", ["worktree", "list", "--porcelain"]).split("\n\n").map((entry) => ({
    path: entry.match(/^worktree (.+)$/m)?.[1],
    branch: entry.match(/^branch refs\/heads\/(.+)$/m)?.[1],
  }));
}

function tryGit(cwd, ...args) {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}

// Where an ignored symlink points, when that is outside the worktree. Deleting such a link deletes
// nothing it points at.
function outsideTarget(root, path) {
  const link = join(root, path);
  try {
    if (!lstatSync(link).isSymbolicLink()) return null;
    const target = realpathSync(link);
    const inside = relative(realpathSync(root), target);
    return inside === ".." || inside.startsWith(`..${sep}`) ? target : null;
  } catch {
    return null;
  }
}

// The ignored files removing a worktree would lose, and the links out of it, which lose nothing.
function ignoredFiles(root) {
  const lost = [];
  const links = [];
  for (const path of git(root, "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory").split("\0")) {
    if (!path || REBUILDABLE.some((entry) => `/${path}/`.includes(`/${entry}/`))) continue;
    const target = outsideTarget(root, path);
    if (target) links.push(`${path} -> ${target}`);
    else lost.push(path);
  }
  return { lost, links };
}

// The local branch and the checkout that holds it. Returns why they were kept, or nothing.
function removeLocal(pr, main, holder) {
  const local = tryGit(main.path, "rev-parse", "--verify", "--quiet", `refs/heads/${pr.branch}`);
  if (!local) {
    console.log(`no local branch ${pr.branch}`);
    return null;
  }
  if (local !== pr.head && tryGit(main.path, "merge-base", "--is-ancestor", local, pr.head) === null) {
    return `the branch ${pr.branch}: it is at ${short(local)}, with commits the merged PR (${short(pr.head)}) never had`;
  }
  if (holder && git(holder.path, "status", "--porcelain") !== "") return `${holder.path}: it has uncommitted changes`;
  if (holder === main) {
    git(main.path, "switch", "--quiet", pr.base);
    console.log(`switched the main checkout, ${main.path}, to ${pr.base}`);
  } else if (holder) {
    const { lost, links } = ignoredFiles(holder.path);
    if (lost.length) {
      const named = lost.slice(0, 5).join(", ") + (lost.length > 5 ? `, and ${lost.length - 5} more` : "");
      return `${holder.path}: removing it would delete ignored files Git doesn't keep: ${named}`;
    }
    try {
      git(main.path, "worktree", "remove", holder.path);
    } catch (error) {
      return `${holder.path}: ${String(error.stderr).trim()}`;
    }
    console.log(`removed the worktree ${holder.path}${links.length ? `, and its links out of it, whose targets stay: ${links.join(", ")}` : ""}`);
  }
  git(main.path, "branch", "--quiet", "-D", pr.branch);
  console.log(`deleted the branch ${pr.branch}`);
  return null;
}

function removeRemote(pr, main) {
  const ref = `refs/heads/${pr.branch}`;
  const line = git(main.path, "ls-remote", "origin", ref).split("\n").find((entry) => entry.endsWith(`\t${ref}`));
  if (!line) {
    console.log(`origin/${pr.branch} is already gone`);
    return null;
  }
  const remote = line.split("\t")[0];
  if (remote !== pr.head) return `origin/${pr.branch}: it moved to ${short(remote)} after the merge`;
  git(main.path, "push", "--quiet", `--force-with-lease=${ref}:${pr.head}`, "origin", `:${ref}`);
  console.log(`deleted origin/${pr.branch}`);
  return null;
}

function main(argv) {
  if (argv.length !== 1 || !PR_URL.test(argv[0])) {
    console.error("usage: after-merge.mjs <PR URL>");
    return 2;
  }
  try {
    const pr = readPr(argv[0]);
    if (pr.state !== "MERGED") {
      console.error(`after-merge: ${argv[0]} is ${pr.state.toLowerCase()}, not merged, so nothing was removed`);
      return 2;
    }
    const checkouts = worktrees();
    const holder = checkouts.find((checkout) => checkout.branch === pr.branch);
    const kept = [removeLocal(pr, checkouts[0], holder), removeRemote(pr, checkouts[0])].filter(Boolean);
    for (const reason of kept) console.log(`kept ${reason}`);
    return kept.length ? 1 : 0;
  } catch (error) {
    console.error(`after-merge: ${String(error?.stderr || error?.message).trim()}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
