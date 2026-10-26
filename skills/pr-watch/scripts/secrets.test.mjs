import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findSecrets } from "./secrets.mjs";

const SECRETS = fileURLToPath(new URL("./secrets.mjs", import.meta.url));

// Each fake is built from parts, so GitHub's push protection never sees a whole token in this file.
const fake = (prefix, length) => prefix + "aB3dE5gH7j".repeat(Math.ceil(length / 10)).slice(0, length);

test("each kind of secret is found on its line", () => {
  const cases = [
    ["a GitHub token", `token: ${fake("gh" + "p_", 36)}`],
    ["a GitHub token", fake("github" + "_pat_", 82)],
    ["an Anthropic API key", `ANTHROPIC_API_KEY=${fake("sk-" + "ant-api03-", 90)}`],
    ["an OpenAI API key", fake("sk-" + "proj-", 100)],
    ["an AWS access key", "aws_access_key_id = " + "AKIA" + "Q2WERTY4UIOP6ASD"],
    ["a Google API key", fake("AI" + "za", 35)],
    ["a Slack token", fake("xox" + "b-", 40)],
    ["a Stripe secret key", fake("sk_" + "live_", 24)],
    ["a JSON web token", `${fake("ey" + "J", 20)}.${fake("ey" + "J", 20)}.${fake("", 20)}`],
    ["a bearer token", `curl -H "Authorization: Bearer ${fake("", 40)}"`],
    ["a password in a URL", "DATABASE_URL=postgres://app:" + "s3cr3tpw" + "@db.internal:5432/app"],
    ["a private key", "-----BEGIN OPENSSH " + "PRIVATE KEY-----"],
  ];
  for (const [kind, line] of cases) assert.deepEqual(findSecrets(`before\n${line}\nafter`), [{ line: 2, kind }], line);
});

test("placeholders and URLs to this machine pass, so a body can show where a secret goes", () => {
  const text = [
    'curl -H "Authorization: Bearer $API_TOKEN"',
    "Authorization: Bearer <token>",
    "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE",
    "DATABASE_URL=postgres://postgres:postgres@localhost:5432/app",
    "REDIS_URL=redis://app:${REDIS_PASSWORD}@cache:6379",
    "GITHUB_TOKEN=$GITHUB_TOKEN",
  ].join("\n");
  assert.deepEqual(findSecrets(text), []);
});

test("the command names the line and the kind, never the secret, and exits 1", () => {
  const token = fake("gh" + "p_", 36);
  const found = spawnSync(process.execPath, [SECRETS], { input: `fine\nexport GH=${token}\n`, encoding: "utf8" });
  assert.equal(found.status, 1);
  assert.match(found.stderr, /line 2: a GitHub token/);
  assert.ok(!found.stderr.includes(token), found.stderr);
  assert.equal(spawnSync(process.execPath, [SECRETS], { input: "fine\n", encoding: "utf8" }).status, 0);
});
