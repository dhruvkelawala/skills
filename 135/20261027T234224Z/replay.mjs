import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? process.cwd());
const base = '2cf5a22b0c83f799c8fa383d78bf5adc3f52ed10';
const gitSource = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const temp = mkdtempSync(join(tmpdir(), 'skills-135-replay-'));
try {
  console.log(`Source head: ${gitSource('rev-parse', 'HEAD')}`);
  console.log(`Baseline: ${base}`);
  console.log('Replay uses synthetic GitHub snapshots and a local Git repository; no network mutations.');
  for (const file of ['pr-gate.mjs', 'held.mjs', 'secrets.mjs']) {
    writeFileSync(join(temp, file), execFileSync('git', ['show', `${base}:skills/pr-watch/scripts/${file}`], {cwd: root}));
  }
  const old = await import(pathToFileURL(join(temp, 'pr-gate.mjs')));
  const current = await import(pathToFileURL(join(root, 'skills/pr-watch/scripts/pr-gate.mjs')));
  const beforeModels = JSON.parse(gitSource('show', `${base}:skills/models.json`));
  const models = JSON.parse(readFileSync(join(root, 'skills/models.json')));
  console.log('\nMODEL DEFAULT');
  console.log('Before: ' + JSON.stringify(beforeModels.jobs.verifier.onCodexThread));
  console.log('After:  ' + JSON.stringify(models.jobs.verifier.onCodexThread));
  assert.equal(models.jobs.verifier.onCodexThread.effort, 'high');
  for (const route of ['onClaudeThread', 'onTeammatePr']) assert.deepEqual(models.jobs.verifier[route], beforeModels.jobs.verifier[route]);
  const head = 'a'.repeat(40);
  const bot = 'review-bot[bot]';
  const snapshot = {
    pr: {state: 'OPEN', isDraft: true, mergeable: true, mergeStateStatus: 'DRAFT', reviewDecision: 'REVIEW_REQUIRED', headRefOid: head, expectedHead: head, headCommittedAt: '2026-10-27T12:00:00Z'},
    requiredChecks: ['ci'],
    checkRuns: [{name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS', required: true}],
    reviews: [], reviewThreads: [], comments: [], reactions: [],
  };
  const options = {reviewers: [bot]};
  console.log('\nDRAFT, CI PASSED, CURRENT-HEAD BOT REVIEW MISSING');
  console.log('Before default gate: ' + JSON.stringify(old.evaluateGate(snapshot, options)));
  const waiting = current.evaluateGate(snapshot, {...options, forVerification: true});
  console.log('After verification gate: ' + JSON.stringify(waiting));
  assert.equal(waiting.state, 'pending');
  snapshot.reviews.push({author: bot, authorType: 'Bot', commitId: head, state: 'COMMENTED', submittedAt: '2026-10-27T12:02:00Z'});
  console.log('\nCURRENT-HEAD BOT REVIEW ARRIVES');
  const ready = current.evaluateGate(snapshot, {...options, forVerification: true});
  console.log('After verification gate: ' + JSON.stringify(ready));
  console.log('Default merge gate: ' + JSON.stringify(current.evaluateGate(snapshot, options)));
  assert.equal(ready.state, 'ready');
  console.log('\nSAFETY BARRIERS');
  const variants = [
    ['Missing required CI', {...snapshot, checkRuns: [{name: 'optional', status: 'COMPLETED', conclusion: 'SUCCESS', required: false}]}, 'pending'],
    ['Failed CI', {...snapshot, checkRuns: [{name: 'ci', status: 'COMPLETED', conclusion: 'FAILURE', required: true}]}, 'blocked'],
    ['Moved pushed head', {...snapshot, pr: {...snapshot.pr, headRefOid: 'b'.repeat(40)}}, 'blocked'],
    ['Unknown BLOCKED state', {...snapshot, pr: {...snapshot.pr, isDraft: false, mergeStateStatus: 'BLOCKED', reviewDecision: 'APPROVED'}}, 'pending'],
  ];
  for (const [name, input, expected] of variants) {
    const result = current.evaluateGate(input, {...options, forVerification: true});
    console.log(`${name}: ${JSON.stringify(result)}`);
    assert.equal(result.state, expected);
  }
  console.log('\nLIVE VERDICT CLI, LOCAL GIT + FAKE EXTERNAL GITHUB');
  const dir = join(temp, 'verdict'); mkdirSync(dir);
  const git = (...args) => execFileSync('git', args, {cwd: dir, encoding: 'utf8'}).trim();
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
  git('remote', 'add', 'origin', dir);
  const commit = (file, contents) => {
    writeFileSync(join(dir, file), contents); git('add', file); git('commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  commit('sample.txt', 'first\n'); git('checkout', '--quiet', '-b', 'feature');
  const tested = commit('sample.txt', 'first\nverified change\n');
  const publish = (sha) => {
    git('update-ref', 'refs/pull/7/head', sha);
    writeFileSync(join(dir, 'pr.json'), JSON.stringify({number: 7, author: {login: 'author'}, baseRefName: 'main', headRefName: 'feature', headRefOid: sha}));
  };
  publish(tested); writeFileSync(join(dir, 'comments.json'), '[]'); mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin', 'gh'), `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
if(args[0] === 'pr' && args[1] === 'list') console.log('[' + fs.readFileSync('pr.json', 'utf8') + ']');
else if(args[0] === 'pr' && args[1] === 'view') console.log(JSON.stringify({comments: JSON.parse(fs.readFileSync('comments.json', 'utf8'))}));
else if(args[0] === 'api' && args[1] === 'user') console.log('reviewer');
else if(args[0] === 'repo' && args[1] === 'view') console.log(JSON.stringify({defaultBranchRef: {name: 'main'}, isArchived: false}));
else if(args[0] === 'pr' && args[1] === 'comment') fs.writeFileSync('comments.json', JSON.stringify([{body: args[args.indexOf('--body') + 1], author: {login: 'reviewer'}, createdAt: '2026-10-27T12:05:00Z'}]));
else throw new Error('Unexpected gh call: ' + args.join(' '));
`, {mode: 0o755});
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, [join(root, 'skills/ship/scripts/ship.mjs'), ...args, '--repo', 'fixture/repo', '--json'], {cwd: dir, env: {...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH}, encoding: 'utf8'}));
  cli('verdict', 'record', '7', 'PASS', '--head', tested, '--by', 'independent-fixture-reviewer');
  let result = cli('verdict', 'check', '7');
  console.log('PASS recorded against tested patch: ' + JSON.stringify(result)); assert.equal(result.status, 'current');
  git('checkout', '--quiet', 'main'); commit('unrelated.txt', 'base movement\n');
  git('checkout', '--quiet', 'feature'); git('rebase', '--quiet', 'main'); publish(git('rev-parse', 'HEAD'));
  result = cli('verdict', 'check', '7');
  console.log('Same-patch restack: ' + JSON.stringify(result)); assert.equal(result.status, 'current');
  publish(commit('sample.txt', 'first\nchanged source\n'));
  result = cli('verdict', 'check', '7');
  console.log('Changed source: ' + JSON.stringify(result)); assert.equal(result.status, 'stale');
  console.log('\nReplay passed. Workflow launch, cancellation and brief bounds remain agent instructions; this replay does not measure production token savings or high-versus-xhigh quality.');
} finally { rmSync(temp, {recursive: true, force: true}); }
