---
name: test-audit
description: Use when writing, changing or reviewing a test, or when the user asks to audit or prune a test suite. Gates each new test on the behaviour it protects and the bug that would fail it, rejects duplicate, tautological and implementation-coupled tests and test-only production seams, and removes low-value tests in owner batches.
---

# Test audit

A test earns its place by guarding behaviour a caller can observe and by going red on a credible bug that no other test catches. Pick the mode from the task:

- **Authoring.** You are about to add or change a test. Pass the authoring gate for each one.
- **Review.** You are judging the tests in a diff. Check each changed test against the junk patterns and the retention bar, and report each hit with the test, the pattern and the fix.
- **Audit.** The user asks to audit, prune or sweep existing tests. Follow [audit](references/audit.md).

When the repo carries its own `test-audit` skill, such as `.agents/skills/test-audit/SKILL.md` in `openclaw/openclaw`, read it and follow it in place of this file. A test-writing guide that the repo's `AGENTS.md` or `CLAUDE.md` names adds to these rules and wins where they disagree.

## Authoring gate

Before you write or change a test, answer four questions:

1. Which observable behaviour, invariant or independent contract does it protect?
2. Which credible regression makes it fail?
3. Why does the existing proof miss it? Each contract has one owning test, at the strongest boundary that reaches it. Find that test first, and add a case to its table or shared fixture when it can hold the new one. A second layer earns its own test only for a risk the first cannot reach, such as a transport or a lifecycle.
4. Does it need an export, flag, wrapper or injection hook that no production caller uses? Move the proof to the real boundary instead.

Write the test only when questions 1 and 2 have concrete answers. Then:

- A regression test goes red before the fix, on its own assertion about the bug rather than on setup, and green after it. Report it when the red run is not possible.
- One test at the owning boundary covers a bug. The other layers the bug crosses keep their existing tests.
- Mock only at the system's outer boundaries: external APIs, time, randomness, and sometimes the database or file system. Use the real modules the repo owns.
- Take each expected value from an independent source: a known literal, a worked example, the spec.
- Name the test for the behaviour its assertions check.
- A refactor that keeps behaviour keeps the test green.

Complete when each new or changed test has answers to all four questions, or was folded into its owner or dropped.

## Junk patterns

Reject a test that matches one of these, unless the retention bar names the independent contract it guards:

- No assertion, or an assertion that compares a value with itself or with a copy the test made.
- An expected value computed the way the code computes it, so the test passes by construction.
- A copied inventory, manifest or export list, or a grep for exact source, import or string text.
- An assertion on call shape, call count or a private predicate that a boundary test already proves, or one shared helper replayed in every caller's suite.
- An export, global, wrapper or production path that only tests call.
- A mock that implements the behaviour the test asserts, or that pretends two different APIs match.
- A fixture that supplies what the owner should produce, such as receipts, admission or callback order, or a persistence check against a store path the code never writes.
- A check through a side channel, such as reading the database directly, when the interface can show the result.
- A capability flag asserted in place of the delivery or acknowledgement it promises.
- A negative case that passes on an unrelated guard, or on a rejection the code never reaches.
- A name that promises behaviour its inputs and assertions never exercise.

## Retention bar

Keep a test that guards an independent contract, even when it is static or slow: a public API, SDK, protocol, config, migration, storage format, security rule, platform behaviour, default value, exact prompt bytes, generated cross-language code, package contents, release step, architecture rule, or an ordering a caller can observe.

- Source inspection is valid when it is the cheapest independent guard of a user-facing key, byte or path, and it survives a rename-only refactor.
- A test that fails on the base may have found a bug. Reproduce it and fix the owner, and keep the test.

Adapted from OpenClaw's `test-audit` (MIT), openclaw/openclaw@3195fba. Upstream license: [LICENSE](LICENSE).
