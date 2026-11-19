# Issue 167 workflow proof
Head: 38c304314eb0b75e4866a1194c8f657a3b33db74
Tree: af89d8f4f2d5a2b8bc5f879f6773b04ba4787642

The message CLI was driven in the separate capture. This file records a real reset CLI drive and a manual walkthrough of the workflow instructions. It does not claim a live downstream issue-to-pr build.

## Risk 3: reset preserves review ownership
$ node skills/issue-to-pr/scripts/reset.mjs before <record>
reset snapshot saved: stage published, repairs 3/10, draft no, guide none, land none

exit: 0
$ node skills/issue-to-pr/scripts/reset.mjs after <record>
record unchanged across the reset: stage published, repairs 3/10, draft no, guide none, land none
first request after the reset: unavailable

exit: 0
Observed: last_reviewed_head, last_reviewed_tree and handoff_review survived both commands unchanged.
The reset guard still checks its original #174 fields; these new fields persist in the record, but are not independently compared by its snapshot.

## Manual walkthrough by criterion

1. Contract: read SKILL.md stage 1 step 6. The five questions are other states, limits/inputs, real path, neighbours and removed behaviour. The output permits at most six numbered risks, one indented test/drive/accepted proof each, or none with a reason. Whole specs plan tickets; each ticket owns its own risks.
2. Persistence: read run-record.md next to Acceptance criteria. The example maps a correction to a public-interface test, a Release restart to exact drive steps, and unavailable service proof to an accepted reason. The brief uses criteria then risks; actual CLI coverage is in the companion capture.
3. Brief: 18 real CLI scenarios in the companion capture exercise missing/empty/over-six/invalid proof lists, omitted/early risks, no-risk reasons, ordinary/ticket/spec records, headerless contracts and accepted recaps. Refusals leave records unchanged.
4. Build: trace the correction test risk through stage 2 step 2: fail on its own assertion, smallest fix, focused test, one commit. Step 4 has one report line per criterion or test risk with red, green, reproduce and surface. This is an instruction trace, not a newly executed product test.
5. Proof: trace the Release restart risk through stage 4: execute its exact drive, capture at HEAD, publish the capture and attach it to its risk row. A test risk uses red/green lines; an accepted risk uses its contract reason. Missing risk proof/reason stops with blocked: evidence. CLI capture publication is demonstrated by this build; a downstream Release app was not launched.
6. Spec review: stage 3 pass 1 sends Risks and build report to the existing spec reviewer. Its prompt rates a plainly missing risk or a test/drive without a runnable proof as P1. Drive capture occurs later in stage 4. This run exercised that route: the reviewer flagged missing handoff/neighbour risks and the contract was expanded, with the repair pass checking the update.
7. Handoff state cases: read stages 3, 7 and 8 together. Completed reviews save the actual reviewed head/tree before repairs; header fields survive reset as driven above. At ready/awaiting-human, a product delta receives one reviewer covering standards and spec over the tree delta. Matching trees and tests/docs/config-only changes skip it. A legacy record recovers its real review basis from its reports. A blocked run retains its limits. A completed handoff_review is reused across stage-6 returns; stage 8 archives/clears it when starting the next batch of requested fixes. No review runs per repair. These are manual branch traces, not an executed downstream pipeline.
7 continued. Re-drive every criterion/risk whose code changed, including fixes made after the delta review. Preserve a test risk red line and rerun for green; re-capture drives; retain accepted reasons. Apply stage-3 P0/P1 priorities, keyed repair budget and three-strikes before another patch. Re-verify and publish with --skip-review after repairs, return to stage 6, and disclose later unreviewed repairs. A failed required drive blocks evidence. This never launches another autoreview.
8. Recap: the real CLI refuses omission of an accepted risk, and accepts the risk on Couldn't check. The instructions put its reason on that line too. The template keeps published drive-risk links with Evidence and the PR table lists each risk.

## Risk 4: neighbours and ownership
Stage 7 step 3 produces the verifier verdict, and the landing reference now points to step 3. Step 2 performs the handoff review. PR risk rows distinguish test red/green proof, published drive capture, and accepted reason. Whole-spec records still have ticket-only plans; the companion CLI drive checks both stack and one-PR forms.

## Limits
No downstream end-to-end issue-to-pr build or six-week escaped-bug study was run. Instruction execution by future agents remains a human-review judgement. The six-week follow-up belongs after merge, as #167 specifies. No merge is authorized in this build.
