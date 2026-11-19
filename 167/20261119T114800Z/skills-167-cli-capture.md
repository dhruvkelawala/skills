# Issue 167 CLI capture
Synthetic run records, real CLI invocations. No models or third-party services invoked.
Base: 2ef0d76d4a25aa4e3da7e46db9ee0d9ca946ec7a
Head: 38c304314eb0b75e4866a1194c8f657a3b33db74
Tree: af89d8f4f2d5a2b8bc5f879f6773b04ba4787642

## Before: missing risk list was accepted
$ node BASE/skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.


Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## After: missing risk list is refused without a write
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.


Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- the contract has no `Risks:` list or `Risks: none` with a reason
record appended: False

## No applicable risks with a reason
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks: none: copy-only change.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## No reason is refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks: none
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- `Risks: none` needs a reason
record appended: False

## All three proof kinds and risk plan
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.
  2. A correction overwrites the answer.
  3. Release loses the answer.
  4. The real service rejects the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## Omitted risk plan is refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- missing risk: A correction overwrites the answer.
- missing risk: Release loses the answer.
- missing risk: The real service rejects the answer.
record appended: False

## Risk before criterion is refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. A correction overwrites the answer.
  2. Save the answer.
  3. Release loses the answer.
  4. The real service rejects the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- list criteria before risks in the plan
record appended: False

## Empty risk list is refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- `Risks:` lists one to at most six risks
record appended: False

## Unrecognized proof is refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. Retry loses an answer.
   later: after launch.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.
  2. Retry loses an answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- risk needs exactly one indented test:, drive: or accepted: proof: Retry loses an answer.
record appended: False

## Seven risks are refused
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. Risk 1.
   test: store interface.
2. Risk 2.
   test: store interface.
3. Risk 3.
   test: store interface.
4. Risk 4.
   test: store interface.
5. Risk 5.
   test: store interface.
6. Risk 6.
   test: store interface.
7. Risk 7.
   test: store interface.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.
  2. Risk 1.
  3. Risk 2.
  4. Risk 3.
  5. Risk 4.
  6. Risk 5.
  7. Risk 6.
  8. Risk 7.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- `Risks:` lists one to at most six risks
record appended: False

## A later report cannot supply missing contract risks
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.


Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- the contract has no `Risks:` list or `Risks: none` with a reason
record appended: False

## Headerless records remain supported
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks: none: copy-only change.
Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## A ticket of a spec still needs its own risk list
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Acceptance criteria:
1. Save the answer.


Message:
Building #167: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. Save the answer.

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 1
brief not saved:
- the contract has no `Risks:` list or `Risks: none` with a reason
record appended: False

## Whole stack spec still plans tickets only
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Tickets:
1. #168 Save the answer
Message:
Building #167 as a stack: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. #168 Save the answer

Stacked on: none · Lane: per PR

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## Whole one-PR spec still plans tickets only
$ node skills/issue-to-pr/scripts/messages.mjs brief <record>
Contract:
Tickets:
1. #168 Save the answer
Message:
Building #167 as one PR: Prove risks

What it's about: Prove the risky cases before handoff.

Plan:
  1. #168 Save the answer

Stacked on: none · Lane: full

🧪 Awkward cases covered
exit: 0
brief saved to <record>
record appended: True

## Before: undisclosed accepted risk was allowed
$ node BASE/skills/issue-to-pr/scripts/messages.mjs recap <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Built for review.

- Built: the score is saved.
- Review: source review complete.
- Verifier: skipped, reversible local CLI change without uncovered rule B risks.
- Evidence: sanitized CLI capture.
- Couldn't check: nothing.
- Next: Dhruv reviews and merges.

🎯 Cases accounted for
exit: 0
recap saved to <record>
record appended: True

## After: undisclosed accepted risk is refused
$ node skills/issue-to-pr/scripts/messages.mjs recap <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Built for review.

- Built: the score is saved.
- Review: source review complete.
- Verifier: skipped, reversible local CLI change without uncovered rule B risks.
- Evidence: sanitized CLI capture.
- Couldn't check: nothing.
- Next: Dhruv reviews and merges.

🎯 Cases accounted for
exit: 1
recap not saved:
- `Couldn't check:` must list accepted risk: The real service rejects the answer.
record appended: False

## Accepted risk is disclosed
$ node skills/issue-to-pr/scripts/messages.mjs recap <record>
Contract:
Acceptance criteria:
1. Save the answer.

Risks:
1. A correction overwrites the answer.
   test: save and read through the store.
2. Release loses the answer.
   drive: save in Release, restart and read the answer.
3. The real service rejects the answer.
   accepted: the real service has no sandbox.
Message:
Built for review.

- Built: the score is saved.
- Review: source review complete.
- Verifier: skipped, reversible local CLI change without uncovered rule B risks.
- Evidence: sanitized CLI capture.
- Couldn't check: The real service rejects the answer. The real service has no sandbox.
- Next: Dhruv reviews and merges.

🎯 Cases accounted for
exit: 0
recap saved to <record>
record appended: True
