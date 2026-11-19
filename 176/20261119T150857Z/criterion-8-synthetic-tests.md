# Criterion 8: synthetic tests only (source audit at 72f27a4d2dbc63dd6be2bdb2e2ba4b742fbc006e, tree 114dad408149ec68df20603c557875e9bb4bd8a2)

$ grep -nE "homedir|statev2|\.t3/|\.claude[^-]|\.codex[^-]|readdir\(home" instrumentation/test/threads*.mjs
instrumentation/test/threads-fixture.mjs:11:  const database = join(home, 'statev2.sqlite');
instrumentation/test/threads.test.mjs:96:    f.thread({ id: 'root', nativeId: native(0), title: 'Build synthetic issue', branch: 'feat/9-synthetic', worktreePath: '/work/.t3/worktrees/synthetic/feat-9', runs: [['2026-11-19T09:00:00Z', null]] });
instrumentation/test/threads.test.mjs:114:    assert.equal(root['langfuse.trace.metadata.worktree'], '/work/.t3/worktrees/synthetic/feat-9');
instrumentation/test/threads.test.mjs:180:      { ...claude.request('2026-11-19T10:00:01Z', 'msg-1', {}, [{ type: 'text', text: C }, { type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: C } }]), wireToolInputs: { toolu_bash: { command: C } } },
instrumentation/test/threads.test.mjs:292:    await f.write(`.codex-test/sessions/2026/11/10/rollout-g-${ids.codex}.jsonl`, [codex.meta('2026-11-10T10:00:00Z', ids.codex), codex.request('2026-11-10T10:00:01Z', 'resp-1', 't1', { input_tokens: 4321 }), codex.request('2026-11-10T10:00:02Z', 'resp-2')]);
instrumentation/test/threads.test.mjs:293:    await f.write(`.codex-test/sessions/2026/11/10/rollout-h-${ids.codexChild}.jsonl`, [codex.meta('2026-11-10T10:00:03Z', ids.codexChild, { source: { subagent: { other: 'guardian' } }, parent_thread_id: ids.codex }), codex.request('2026-11-10T10:00:04Z', 'resp-child', 't9', { output_tokens: 77 })]);
instrumentation/test/threads.test.mjs:303:    assert.equal(expected[`codex:${ids.codex}`].requests, 3, 'a Codex subagent counts in its parent');

$ grep -n "mkdtemp\|new DatabaseSync" instrumentation/test/threads-fixture.mjs
4:import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
10:  const home = await mkdtemp(join(tmpdir(), 't3-threads-'));
12:  const db = new DatabaseSync(database);

Every thread test calls fixture(), which builds transcripts under a fresh mkdtemp home (.claude-test/.codex-test folders) and a fresh statev2.sqlite with only synthetic rows; no test passes a real home or T3 database.
