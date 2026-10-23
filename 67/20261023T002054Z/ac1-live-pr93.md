# #67 criterion 1, live on PR #93 at 53eed00

The build's own PR, run through the new stage 5 and stage 7 steps in T3.

## Stage 5 step 6, right after publish (2026-10-23T00:19Z)

```text
write_pull_request_guides({ pullRequests: [{ url: "https://github.com/dhruvkelawala/skills/pull/93" }] })
→ { number: 93, outcome: "started" }
```

## Stage 7 step 6, before the recap

```text
read_pull_request_guide({ url: ".../pull/93" })
→ guide: null, run: { _tag: "Running", headSha: "53eed001a67dd152fbd76768603a72e7dacba15b" },
  currentHeadSha: "53eed001a67dd152fbd76768603a72e7dacba15b", stale: false
   (wait, read again)
read_pull_request_guide({ url: ".../pull/93" })
→ guide: { headSha: "53eed001a67dd152fbd76768603a72e7dacba15b", generatedAt: "2026-10-23T00:20:14Z", stops: 6 },
  run: null, currentHeadSha: "53eed001a67dd152fbd76768603a72e7dacba15b", stale: false
```

Stops the guide holds, in order:

1. The recap becomes the intro to the user's own review
2. The verifier moves out from behind --merge and into every recap
3. A script decides whether the PR opens as a draft
4. Publish opens the draft; watch waits on the user instead of handing back
5. Hand-off waits for the guide, then the user reviews in the thread
6. Bookkeeping: run record fields, prompt text, taste-page linker

Recorded `guide: written for 53eed001a67dd152fbd76768603a72e7dacba15b`, then saved the recap with the head's `messages.mjs recap`, whose first line links PR #93 and points at the Guide tab.
