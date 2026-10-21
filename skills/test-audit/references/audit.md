# Audit

An audit applies the [junk patterns](../SKILL.md#junk-patterns) and the [retention bar](../SKILL.md#retention-bar) to tests that already exist. Steps 1 and 2 are read-only, and you report the ledger before any edit. Steps 3 and 5 run only when the audit has more than one lane.

## 1. Baseline

Pin the base SHA. Record the test, support and production line counts in scope, and run every in-scope test file. Keep the base failures on their own list: each may be a product bug, and the retention bar keeps its test.

Complete when every in-scope test file has a recorded result at the pinned SHA.

## 2. Ledger

Split the in-scope tests into lanes along production owner boundaries rather than file names. A small audit is one lane; a whole subsystem gets one lane per owner, and each lane can go to its own read-only helper agent.

Read each test in full, including its parameter tables, with its production owner, entry point, callers, callees, sibling tests, overlapping proof, CI routing and history. For a claim that rests on a dependency, read the dependency's source or types. Judge a test by its assertions, not its name. Give each test declaration one mark; a table is one declaration unless its rows need different marks:

- `R` retain: name the contract and the bug it catches.
- `F` fix: keep the contract and repair the assertion, such as a negative case that passes when only one of several items is missing.
- `C` consolidate: name the owner that absorbs the assertion, such as a sibling table case, a stronger boundary suite or a shared owner in another package.
- `D` delete: name the proof that remains, or why no contract exists.

For each `C` and `D`, also record the failure the test can detect, the non-test callers of the production seam it covers, why it exists according to history, what its removal unlocks, the risk, and the focused command that validates the change. A test whose evidence is incomplete stays `R`. A few high-confidence candidates beat a long list.

Complete when every declaration in scope has a mark and an evidence line, and the ledger is reported.

## 3. Layer plan

Read the ledger again, looking for a redundant layer: several suites replaying the same shared logic through a mock, beside a stronger suite at the real boundary. Name the keeper suite for each contract, preferring the real transport boundary with a fake network over a mocked collaborator. Correct any mark this pass shows to be wrong.

Complete when each lane names its retired files, its keeper per contract, the assertions to carry into keepers, and the test-only production seams the change unlocks.

## 4. Cut over

Edit one lane at a time, and make changes to shared harnesses and fixtures in one place. With each lane, delete the test-only production seams it unlocks: injection parameters, getters, reset exports and indirection layers. Move retained regressions to their owner. Aim for a net drop in production lines.

Fix a base failure that is a product bug at its owner, in its own commit, with a control run that reverts the fix and shows the test go red. Record unrelated product problems as follow-ups.

Run the owner and sibling tests, the formatter on changed files and `git diff --check`. Run the repo's dead-code or unused-export check when it has one, because removed tests orphan support files and exports. For a removed source grep or plan assertion, run the executable or dry run it guarded.

Complete when every lane plan is applied, each keeper passes, and each fixed product bug has a red control run and a green run on the same harness.

## 5. Preservation review

Have independent reviewers, one per boundary group, compare the deleted coverage with the keepers. They look for a contract that lost its only proof, and for a new assertion that cannot fail. For each contract you restore, make one deliberate mutation in its production owner, see the keeper go red, and restore the source byte for byte.

Complete when every reported gap is restored or rejected with source evidence, and each restored contract has a caught mutation.

## 6. Report

- Base SHA, and test, support and production line counts before and after
- Why the removed tests existed and what made them low value
- Removed categories and production seams, the keeper for each contract, and junk-pattern matches kept under the retention bar
- Each base failure and what happened to it
- Preservation gaps found and their mutations, when step 5 ran
- Validation commands and results, and follow-ups

Before another audit batch, update from the default branch and build a new ledger.
