// Stands in for gh during the eval: answers as acme/demo with the chain's open PRs (#7, and in the queue chain
// the layer #5 stacked on it) read live from the fixture's origin repo, keeps posted reviews in
// $FAKE_DIR/reviews.json, and logs every call to $FAKE_DIR/gh.jsonl. Every open PR asks for the user's review.
// A call it does not model exits 1, so the agent can't read a made-up success.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AUTHOR, HEAD_BRANCH, ISSUE, ISSUE_BODY, ISSUE_TITLE, LAYER, LAYER_BODY, LAYER_BRANCH, LAYER_TITLE, LAYER_URL, OWNER, PR, PR_BODY, PR_TITLE, PR_URL, REPO, USER } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const { origin, prs = [PR] } = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
const PRS = {
  [PR]: { url: PR_URL, title: PR_TITLE, body: PR_BODY, branch: HEAD_BRANCH, baseBranch: "main", closes: [ISSUE] },
  [LAYER]: { url: LAYER_URL, title: LAYER_TITLE, body: LAYER_BODY, branch: LAYER_BRANCH, baseBranch: HEAD_BRANCH, closes: [] },
};
const reviewsFile = join(dir, "reviews.json");
const reviews = existsSync(reviewsFile) ? JSON.parse(readFileSync(reviewsFile, "utf8")) : [];

const args = process.argv.slice(2).flatMap((a) => (/^--[\w-]+=/.test(a) ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a]));
appendFileSync(join(dir, "gh.jsonl"), `${JSON.stringify({ at: Date.now(), args })}\n`);

const BOOLEAN_FLAGS = new Set(["--web", "-w", "--comments", "-c", "--paginate", "--slurp", "-i", "--include", "--silent", "--verbose", "--name-only", "--patch", "--required", "--watch"]);
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
const git = (...a) => execFileSync("git", ["-C", origin, ...a], { encoding: "utf8" }).trim();

function print(data) {
  const json = JSON.stringify(data);
  const jq = flag("--jq", "-q");
  process.stdout.write(jq ? execFileSync("jq", ["-r", jq], { input: json, encoding: "utf8" }) : `${json}\n`);
}

function pick(data, fields) {
  if (!fields) return data;
  const wanted = fields.split(",");
  const unknown = wanted.filter((f) => !(f in data));
  if (unknown.length) fail(`Unknown JSON field: "${unknown[0]}"\nAvailable fields:\n  ${Object.keys(data).join("\n  ")}`);
  return Object.fromEntries(wanted.map((f) => [f, data[f]]));
}

function pull(n) {
  const base = git("rev-parse", `refs/heads/${PRS[n].baseBranch}`);
  const head = git("rev-parse", `refs/pull/${n}/head`);
  const files = git("diff", "--numstat", `${base}...${head}`)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [additions, deletions, path] = line.split("\t");
      return { path, additions: Number(additions), deletions: Number(deletions) };
    });
  const commits = git("log", "--reverse", "--format=%H%x09%s%x09%cI", `${base}..${head}`)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [oid, messageHeadline, committedDate] = line.split("\t");
      return { oid, messageHeadline, committedDate, authors: [{ login: AUTHOR }] };
    });
  return { base, head, files, commits };
}

function prJson(n) {
  const { base, head, files, commits } = pull(n);
  const { url, title, body, branch, baseBranch, closes } = PRS[n];
  return {
    number: n,
    url,
    title,
    body,
    state: "OPEN",
    isDraft: false,
    author: { login: AUTHOR },
    baseRefName: baseBranch,
    baseRefOid: base,
    headRefName: branch,
    headRefOid: head,
    headRepository: { name: REPO },
    headRepositoryOwner: { login: OWNER },
    isCrossRepository: false,
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
    changedFiles: files.length,
    files,
    commits,
    createdAt: commits[0]?.committedDate,
    updatedAt: commits.at(-1)?.committedDate,
    labels: [],
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: "REVIEW_REQUIRED",
    reviewRequests: [{ login: USER }],
    reviews: reviewsOf(n).map((r) => ({ author: { login: USER }, state: r.state, body: r.body, commit: { oid: r.commit_id } })),
    latestReviews: [],
    comments: [],
    closingIssuesReferences: closes.map((i) => ({ number: i, url: `https://github.com/${OWNER}/${REPO}/issues/${i}` })),
    statusCheckRollup: [{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "SUCCESS" }],
  };
}

const issueJson = () => ({
  number: ISSUE,
  title: ISSUE_TITLE,
  body: ISSUE_BODY,
  state: "OPEN",
  author: { login: AUTHOR },
  labels: [{ name: "ready-for-agent" }],
  comments: [],
  url: `https://github.com/${OWNER}/${REPO}/issues/${ISSUE}`,
});
const repoJson = () => ({
  name: REPO,
  owner: { login: OWNER },
  nameWithOwner: `${OWNER}/${REPO}`,
  url: `https://github.com/${OWNER}/${REPO}`,
  defaultBranchRef: { name: "main" },
  isArchived: false,
  visibility: "PUBLIC",
});
const reviewsOf = (n) => reviews.filter((r) => (r.pr ?? PR) === n);
// The open PR a `gh pr` argument names: its number, URL or head branch, or #7 when there is none.
const prOf = (ref) => (ref === undefined ? PR : prs.find((n) => String(ref).replace(/^#/, "") === String(n) || ref === PRS[n].url || ref === PRS[n].branch));
const restPr = (n) => {
  const p = prJson(n);
  const repo = { full_name: `${OWNER}/${REPO}`, archived: false };
  return { number: n, html_url: p.url, title: p.title, body: p.body, state: "open", merged: false, draft: false, user: { login: AUTHOR }, base: { ref: p.baseRefName, sha: p.baseRefOid, repo }, head: { ref: p.headRefName, sha: p.headRefOid, repo }, additions: p.additions, deletions: p.deletions, changed_files: p.changedFiles };
};
const searchHit = (n) => {
  const p = prJson(n);
  return { number: n, url: p.url, title: p.title, state: "open", isDraft: false, isPullRequest: true, author: { login: AUTHOR }, repository: { name: REPO, nameWithOwner: `${OWNER}/${REPO}` }, labels: [], createdAt: p.createdAt, updatedAt: p.updatedAt };
};
const printList = (items) => print(has("--slurp") ? [items] : items);

function api(path) {
  const method = (flag("-X", "--method") ?? (has("-f", "-F", "--field", "--raw-field", "--input") ? "POST" : "GET")).toUpperCase();
  const route = path.replace("{owner}", OWNER).replace("{repo}", REPO).replace(/^\//, "").split("?")[0];
  const n = Number(/^repos\/[^/]+\/[^/]+\/(?:pulls|issues)\/(\d+)/.exec(route)?.[1]);
  const pr = `repos/${OWNER}/${REPO}/pulls/${n}`;
  if (route === "user") return print({ login: USER, type: "User" });
  if (route === "graphql") fail("fake gh: graphql is not modelled here; use the REST call");
  if (route === `repos/${OWNER}/${REPO}`) return print({ name: REPO, full_name: `${OWNER}/${REPO}`, owner: { login: OWNER }, default_branch: "main", archived: false });
  if (route === `repos/${OWNER}/${REPO}/issues/${ISSUE}`) return print({ number: ISSUE, title: ISSUE_TITLE, body: ISSUE_BODY, state: "open", user: { login: AUTHOR } });
  if (route === `repos/${OWNER}/${REPO}/pulls` && method === "GET") return printList(prs.map(restPr));
  if (route === `repos/${OWNER}/${REPO}/issues/${ISSUE}/comments` || (prs.includes(n) && route === `repos/${OWNER}/${REPO}/issues/${n}/comments`)) return printList([]);
  if (route.startsWith(`repos/${OWNER}/${REPO}/commits/`) && route.endsWith("/check-runs")) return print({ total_count: 1, check_runs: [{ name: "test", status: "completed", conclusion: "success" }] });
  if (!prs.includes(n)) fail(`fake gh: api ${method} ${route} is not modelled`);
  if (route === pr) return print(restPr(n));
  if (route === `${pr}/files`) return printList(prJson(n).files.map((f) => ({ filename: f.path, additions: f.additions, deletions: f.deletions, status: "modified" })));
  if (route === `${pr}/commits`) return printList(prJson(n).commits.map((c) => ({ sha: c.oid, commit: { message: c.messageHeadline } })));
  if (route === `${pr}/comments`) return printList(reviewsOf(n).flatMap((r) => r.comments ?? []));
  if (route === `${pr}/reviews` && method === "GET") return printList(reviewsOf(n));
  if (route === `${pr}/reviews` && method === "POST") {
    const fields = Object.fromEntries(args.flatMap((a, i) => (["-f", "-F", "--field", "--raw-field"].includes(a) ? [args[i + 1].split(/=(.*)/s).slice(0, 2)] : [])));
    const input = flag("--input");
    const body = input ? JSON.parse(readFileSync(input === "-" ? 0 : input, "utf8")) : fields;
    const review = { id: reviews.length + 1, pr: n, user: { login: USER }, state: body.event ?? "COMMENTED", body: body.body ?? "", commit_id: body.commit_id, submitted_at: new Date().toISOString(), comments: body.comments ?? [], html_url: `${PRS[n].url}#pullrequestreview-${reviews.length + 1}` };
    reviews.push(review);
    writeFileSync(reviewsFile, JSON.stringify(reviews, null, 2));
    return print(review);
  }
  fail(`fake gh: api ${method} ${route} is not modelled`);
}

const [group, command] = positionals;
if (group === "auth" && command === "status") process.stdout.write(`github.com\n  ✓ Logged in to github.com account ${USER}\n`);
else if (group === "api") api(positionals[1]);
else if (group === "repo" && command === "view") print(pick(repoJson(), flag("--json")));
else if (group === "issue" && command === "view" && Number(String(positionals[2]).match(/(\d+)$/)?.[1]) === ISSUE) {
  if (has("--json")) print(pick(issueJson(), flag("--json")));
  else process.stdout.write(`${ISSUE_TITLE} #${ISSUE}\nOpen • ${AUTHOR}\n\n${ISSUE_BODY}`);
} else if (group === "pr" && command === "view" && prOf(positionals[2])) {
  const p = prJson(prOf(positionals[2]));
  if (has("--json")) print(pick(p, flag("--json")));
  else process.stdout.write(`${p.title} #${p.number}\nOpen • ${AUTHOR} wants to merge into ${p.baseRefName} from ${p.headRefName}\n\n${p.body}\n${p.url}\n`);
} else if (group === "pr" && command === "diff" && prOf(positionals[2])) {
  const { base, head } = pull(prOf(positionals[2]));
  process.stdout.write(`${git("diff", ...(has("--name-only") ? ["--name-only"] : []), `${base}...${head}`)}\n`);
} else if (group === "pr" && command === "checks" && prOf(positionals[2])) {
  process.stdout.write(`test\tpass\t12s\thttps://github.com/${OWNER}/${REPO}/actions/runs/1\n`);
} else if (group === "pr" && command === "list") {
  if (has("--json")) print(prs.map((n) => pick(prJson(n), flag("--json"))));
  else process.stdout.write(prs.map((n) => `${n}\t${PRS[n].title}\t${PRS[n].branch}\tOPEN\n`).join(""));
} else if (group === "search" && command === "prs" && flag("--state") === "open") {
  const hits = flag("--review-requested") === "@me" ? prs : flag("--reviewed-by") === "@me" ? prs.filter((n) => reviewsOf(n).length) : null;
  if (!hits) fail(`fake gh: ${args.join(" ")} is not modelled`);
  print(hits.map((n) => (has("--json") ? pick(searchHit(n), flag("--json")) : searchHit(n))));
} else fail(`fake gh: ${args.join(" ")} is not modelled`);
