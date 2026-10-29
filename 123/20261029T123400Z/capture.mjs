import { pathToFileURL } from 'node:url';

const [basePath, headPath, baseSha, headSha] = process.argv.slice(2);
const before = (await import(pathToFileURL(basePath))).evaluateGate;
const after = (await import(pathToFileURL(headPath))).evaluateGate;
const head = 'a'.repeat(40);
const other = 'b'.repeat(40);
const reviewer = 'chatgpt-codex-connector';
const requestComment = '@codex review';
const summary = (commit_sha, status, has_unresolved_findings, security_review = null) =>
  `<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha, status, has_unresolved_findings }, security_review })} -->`;
const snapshot = (body, createdAt = '2026-08-28T20:42:39Z') => ({
  pr: { state: 'OPEN', isDraft: false, mergeable: true, mergeStateStatus: 'CLEAN',
    reviewDecision: 'APPROVED', headRefOid: head, expectedHead: head,
    headCommittedAt: '2026-08-28T20:39:38Z' },
  requiredChecks: [],
  checkRuns: [{ name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  comments: [
    { author: 'pr-author', body: requestComment, createdAt: '2026-08-28T20:40:00Z' },
    { author: `${reviewer}[bot]`, body, createdAt },
  ],
  reviews: [], reviewThreads: [], reactions: [],
});
const options = { reviewers: [reviewer], requestComment };
console.log('Issue #123: evaluateGate with synthetic GitHub snapshots');
console.log(`Base: ${baseSha}\nHead: ${headSha}`);
console.log('All unrelated gate conditions are clean. No live GitHub data is used.');
for (const [name, body, createdAt] of [
  ['New summary running for HEAD', summary(head, 'running', null)],
  ['Old summary completed for HEAD', summary(head, 'completed', false), '2026-08-28T20:00:00Z'],
  ['New summary completed for another commit', summary(other, 'completed', false)],
  ['New reviewer comment without a marker', 'Review complete.'],
]) {
  const input = snapshot(body, createdAt);
  console.log(`\n${name}`);
  console.log(`Before: ${JSON.stringify(before(input, options))}`);
  console.log(`After:  ${JSON.stringify(after(input, options))}`);
}
console.log('\nVerification behavior before and after:');
for (const [name, body] of [
  ['Running code review', summary(head, 'running', null)],
  ['Completed without findings', summary(head, 'completed', false)],
  ['Completed with findings', summary(head, 'completed', true)],
  ['Other commit', summary(other, 'completed', false)],
  ['Unreadable marker', '<!-- codex-review-state:v1 invalid -->'],
  ['Security review still running', summary(head, 'completed', false, { commit_sha: head, status: 'running', has_unresolved_findings: null })],
]) {
  const input = snapshot(body);
  const verificationOptions = { ...options, forVerification: true };
  const oldResult = before(input, verificationOptions);
  const newResult = after(input, verificationOptions);
  if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) throw new Error(`Verification changed: ${name}`);
  console.log(`${name}: ${JSON.stringify(newResult)} (unchanged)`);
}
