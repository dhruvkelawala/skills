// Stands in for gh in day's tests and eval. It answers from a world in the JSON file $FAKE_GH_WORLD: the user's
// login, and each repository's issues and PRs with their comments and reviews. It models the calls the morning script
// and pr-review's queue script make (REST search, REST lists with --paginate --slurp, `gh search prs`) and the REST
// reads an agent makes about one repository, issue or PR. $FAKE_GH_LOG, when set, gets one line per call.
// A call it does not model exits 1, so a caller can't read a made-up success.
//
// World: { me, repos: { "<owner>/<name>": { archived, gone, defaultBranch, pushedAt, issues: [issue], pulls: [pull] } } }
//   gone: search still lists the repository's issues and PRs, but its REST reads fail with a 404, as for a
//         repository the user lost access to.
//   issue: { number, title, author, state, labels, body, createdAt, updatedAt, involves, blockedBy, blocking }
//   pull:  { number, title, author, state ("open" | "merged" | "closed"), draft, body, base, head, sha, createdAt,
//            updatedAt, mergedAt, requested, additions, deletions, files, comments, reviewComments, reviews }
//   comment: { author, at, body }   review: { author, at, state, body, commit }
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { me, repos } = JSON.parse(readFileSync(process.env.FAKE_GH_WORLD, "utf8"));
const args = process.argv.slice(2).flatMap((a) => (/^--[\w-]+=/.test(a) ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a]));
if (process.env.FAKE_GH_LOG) appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ at: Date.now(), args })}\n`);

const BOOLEAN_FLAGS = new Set(["--paginate", "--slurp", "-i", "--include", "--silent", "--verbose"]);
const positionals = args.filter((a, i) => !a.startsWith("-") && !(i > 0 && args[i - 1].startsWith("-") && !BOOLEAN_FLAGS.has(args[i - 1])));
const flag = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (...names) => args.some((a) => names.includes(a));
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};
const same = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

function print(data) {
  const json = JSON.stringify(data);
  const jq = flag("--jq", "-q");
  process.stdout.write(jq ? execFileSync("jq", ["-r", jq], { input: json, encoding: "utf8" }) : `${json}\n`);
}
const printList = (items) => print(has("--slurp") ? [items] : items);

const web = (repo) => `https://github.com/${repo}`;
const repoRest = (repo) => ({ name: repo.split("/")[1], full_name: repo, owner: { login: repo.split("/")[0] }, archived: Boolean(repos[repo].archived), default_branch: repos[repo].defaultBranch ?? "main", pushed_at: repos[repo].pushedAt ?? null, html_url: web(repo) });
const user = (login) => ({ login, type: login.endsWith("[bot]") ? "Bot" : "User" });
const deps = (i) => ({ blocked_by: i.blockedBy ?? 0, total_blocked_by: i.blockedBy ?? 0, blocking: i.blocking ?? 0, total_blocking: i.blocking ?? 0 });

const issueRest = (repo, i) => ({
  number: i.number, title: i.title, body: i.body ?? "", state: i.state ?? "open", user: user(i.author),
  labels: (i.labels ?? []).map((name) => ({ name })), created_at: i.createdAt, updated_at: i.updatedAt ?? i.createdAt,
  html_url: `${web(repo)}/issues/${i.number}`, repository_url: `https://api.github.com/repos/${repo}`, issue_dependencies_summary: deps(i),
});
const pullState = (p) => (p.state === "open" || !p.state ? "open" : "closed");
const pullRest = (repo, p) => ({
  number: p.number, title: p.title, body: p.body ?? "", state: pullState(p), draft: Boolean(p.draft), merged: p.state === "merged",
  merged_at: p.mergedAt ?? null, user: user(p.author), html_url: `${web(repo)}/pull/${p.number}`,
  created_at: p.createdAt, updated_at: p.updatedAt ?? p.createdAt,
  base: { ref: p.base ?? "main", repo: { full_name: repo, archived: Boolean(repos[repo].archived) } },
  head: { ref: p.head ?? `branch-${p.number}`, sha: p.sha ?? `sha${p.number}`, repo: { full_name: repo } },
  additions: p.additions ?? 0, deletions: p.deletions ?? 0, changed_files: p.files ?? 1,
});
// A search hit is an issue-shaped item; a PR's carries pull_request with its merge time.
const pullHit = (repo, p) => ({
  ...issueRest(repo, { ...p, state: pullState(p) }), html_url: `${web(repo)}/pull/${p.number}`, draft: Boolean(p.draft),
  pull_request: { merged_at: p.mergedAt ?? null, html_url: `${web(repo)}/pull/${p.number}` },
});

// REST search over the world, for the qualifiers the scripts use. Every other word must appear in the body.
function searchIssues(q) {
  const terms = q.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const items = Object.entries(repos).flatMap(([repo, r]) => [
    ...(r.issues ?? []).map((i) => ({ repo, kind: "issue", x: i })),
    ...(r.pulls ?? []).map((p) => ({ repo, kind: "pr", x: p })),
  ]);
  const keep = ({ repo, kind, x }) =>
    terms.every((term) => {
      const [key, ...rest] = term.split(":");
      const value = rest.join(":").replace(/^"|"$/g, "");
      if (term === "is:issue") return kind === "issue";
      if (term === "is:pr") return kind === "pr";
      if (term === "is:open") return (x.state ?? "open") === "open";
      if (term === "is:merged") return x.state === "merged";
      if (term === "archived:false") return !repos[repo].archived;
      if (term === "in:body") return true;
      if (key === "label") return (x.labels ?? []).includes(value);
      if (key === "-label") return !(x.labels ?? []).includes(value);
      if (key === "user") return same(repo.split("/")[0], value);
      if (key === "author") return same(x.author, value);
      if (key === "involves") return same(x.author, value) || (x.involves ?? []).some((login) => same(login, value));
      if (key === "merged" && value.startsWith(">=")) return Boolean(x.mergedAt) && x.mergedAt.slice(0, 10) >= value.slice(2);
      if (rest.length) fail(`fake gh: search qualifier ${term} is not modelled`);
      return (x.body ?? "").toLowerCase().includes(term.replace(/"/g, "").toLowerCase());
    });
  return items.filter(keep).map(({ repo, kind, x }) => (kind === "pr" ? pullHit(repo, x) : issueRest(repo, x)));
}

// A comment's URL comes from its place in the full list, so it stays the same whichever page or filter reads it.
const commentRest = (url) => (c, i) => ({ user: user(c.author), body: c.body, created_at: c.at, updated_at: c.at, html_url: `${url}#comment-${i + 1}` });
const reviewRest = (url) => (r, i) => ({ user: user(r.author), state: r.state, body: r.body ?? "", submitted_at: r.at, commit_id: r.commit, html_url: `${url}#review-${i + 1}` });
const since = (list, query) => list.filter((c) => !query.get("since") || c.updated_at >= query.get("since"));

function api(path) {
  if (has("-X", "--method") && flag("-X", "--method").toUpperCase() !== "GET") fail(`fake gh: api ${flag("-X", "--method")} ${path} is not modelled`);
  const [route, search = ""] = path.replace(/^\//, "").split("?");
  const query = new URLSearchParams(search);
  if (route === "user") return print(user(me));
  if (route === "search/issues") {
    const items = searchIssues(query.get("q") ?? flag("-f")?.replace(/^q=/, "") ?? "");
    return print(has("--slurp") ? [{ total_count: items.length, incomplete_results: false, items }] : { total_count: items.length, incomplete_results: false, items });
  }
  const [, owner, name, kind, number, sub] = route.split("/");
  const repo = `${owner}/${name}`;
  if (route.split("/")[0] !== "repos" || !repos[repo]) fail(`fake gh: api ${route} is not modelled`);
  const r = repos[repo];
  if (r.gone) fail("gh: Not Found (HTTP 404)");
  if (!kind) return print(repoRest(repo));
  const n = Number(number);
  if (kind === "pulls" && !number) return printList((r.pulls ?? []).filter((p) => query.get("state") !== "open" || pullState(p) === "open").map((p) => pullRest(repo, p)));
  if (kind === "issues" && !number) return printList((r.issues ?? []).filter((i) => (query.get("state") ?? "open") === "all" || (i.state ?? "open") === (query.get("state") ?? "open")).map((i) => issueRest(repo, i)));
  const issue = (r.issues ?? []).find((i) => i.number === n);
  const pull = (r.pulls ?? []).find((p) => p.number === n);
  const url = `${web(repo)}/${pull ? "pull" : "issues"}/${n}`;
  if (kind === "issues" && !sub && issue) return print(issueRest(repo, issue));
  if (kind === "issues" && !sub && pull) return print(pullHit(repo, pull));
  if (kind === "issues" && sub === "comments" && (issue || pull)) return printList(since(((issue ?? pull).comments ?? []).map(commentRest(url)), query));
  if (kind === "pulls" && pull && !sub) return print(pullRest(repo, pull));
  if (kind === "pulls" && pull && sub === "comments") return printList(since((pull.reviewComments ?? []).map(commentRest(url)), query));
  if (kind === "pulls" && pull && sub === "reviews") return printList((pull.reviews ?? []).map(reviewRest(url)));
  fail(`fake gh: api ${route} is not modelled`);
}

// `gh search prs` as pr-review's queue script calls it: open PRs that ask for the user's review, or that they reviewed.
function searchPrs() {
  if (flag("--state") !== "open") fail(`fake gh: ${args.join(" ")} is not modelled`);
  const hits = Object.entries(repos)
    .flatMap(([repo, r]) => (r.pulls ?? []).map((p) => [repo, p]))
    .filter(([, p]) => pullState(p) === "open")
    .filter(([, p]) => (flag("--review-requested") === "@me" && p.requested) || (flag("--reviewed-by") === "@me" && (p.reviews ?? []).some((v) => same(v.author, me))));
  print(hits.map(([repo, p]) => ({
    number: p.number, title: p.title, url: `${web(repo)}/pull/${p.number}`, author: { login: p.author }, isDraft: Boolean(p.draft),
    repository: { name: repo.split("/")[1], nameWithOwner: repo },
  })));
}

const [group, command] = positionals;
if (group === "auth" && command === "status") process.stdout.write(`github.com\n  ✓ Logged in to github.com account ${me}\n`);
else if (group === "api") api(positionals[1]);
else if (group === "search" && command === "prs") searchPrs();
else fail(`fake gh: ${args.join(" ")} is not modelled; use gh api with the REST route`);
