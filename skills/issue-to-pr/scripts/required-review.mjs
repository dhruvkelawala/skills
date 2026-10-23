#!/usr/bin/env node
// Whether GitHub asks for an approving review before a PR merges into a branch. Where it does, stage 5
// opens the PR as a draft, so nobody is asked to review it before the user has.
//
//   required-review.mjs <owner/repo> <branch>
//
// Prints `review required: <n> approval(s)` or `no review required` and exits 0. A failed read exits
// 2, so it never reads as "no review". GraphQL shows classic protection and rulesets to anyone who can
// read the repository. When the GraphQL quota every agent on the account shares is spent, REST answers
// instead. REST shows a classic rule's details only to admins, so there any protected branch counts
// as asking for one approval.

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES_QUERY = "query($o:String!,$n:String!,$q:String!){repository(owner:$o,name:$n){ref(qualifiedName:$q){refUpdateRule{requiredApprovingReviewCount} rules(first:100){nodes{type parameters{... on PullRequestParameters{requiredApprovingReviewCount}}}}}}}";

const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const rateLimited = (error) => /rate limit|RATE_LIMITED/i.test(`${error?.stderr ?? ""}\n${error?.stdout ?? ""}`);
const highest = (counts) => Math.max(0, ...counts.filter(Number.isInteger));

function approvals(repo, branch) {
  const [owner, name] = repo.split("/");
  try {
    const { ref } = gh(["api", "graphql", "-f", `query=${RULES_QUERY}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-f", `q=refs/heads/${branch}`]).data.repository;
    const rulesets = (ref?.rules?.nodes ?? []).filter((rule) => rule.type === "PULL_REQUEST");
    return highest([ref?.refUpdateRule?.requiredApprovingReviewCount, ...rulesets.map((rule) => rule.parameters?.requiredApprovingReviewCount)]);
  } catch (error) {
    if (!rateLimited(error)) throw error;
  }
  process.stderr.write("required-review: GitHub's GraphQL quota is spent, so this reads REST, where any protected branch counts as asking for a review\n");
  const rulesets = restRulesets(repo, branch).filter((rule) => rule.type === "pull_request");
  const isProtected = gh(["api", `repos/${repo}/branches/${branch}`]).protected === true;
  return highest([isProtected ? 1 : 0, ...rulesets.map((rule) => rule.parameters?.required_approving_review_count)]);
}

function restRulesets(repo, branch) {
  try {
    return gh(["api", `repos/${repo}/rules/branches/${branch}?per_page=100`]);
  } catch (error) {
    // A plan without rulesets answers 403 or 404, and has none to read. A rate limit's 403 says
    // nothing about them.
    if (rateLimited(error) || !/HTTP 40[34]/.test(error?.stderr ?? "")) throw error;
    return [];
  }
}

function main(argv) {
  const [repo, branch] = argv;
  if (argv.length !== 2 || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    console.error("usage: required-review.mjs <owner/repo> <branch>");
    return 2;
  }
  try {
    const count = approvals(repo, branch);
    console.log(count ? `review required: ${count} approval${count === 1 ? "" : "s"}` : "no review required");
    return 0;
  } catch (error) {
    console.error(`required-review: ${String(error?.stderr || error?.message).trim()}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
