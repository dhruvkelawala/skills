# Verification skill and private PR evidence

Researched 2026-10-25 against primary sources. T3 Code citations are `pingdotgg/t3code@5b35402` unless noted.

## Summary

1. A: The generic skill writes from a reading of the repo. The sources agree that this yields generic procedures. Build each project skill from a real verification run and its corrections, then have a fresh agent replay it.
2. A: Port upstream's 2026-10-12 readiness fix. Ready means usable from an empty data dir, with migrations and seed data. Add a required "Test data" section, since an empty database is a bad test.
3. A: Require a short "ways to hurt yourself" list: kill only captured PIDs, never touch the live install, never assume a server or simulator is yours.
4. A: Default to helper scripts for fragile, deterministic steps such as native-build checks, credential minting, fixture seeding and publishing. Keep judgment in prose.
5. A: Ship per-stack recipes as one-level-deep references holding traps and questions, seeded from Lore and Visaroy. Track drift with a sync commit per feature. Use PR review comments only as a secondary input.
6. B: For a private work repo, publish with `gh pr edit <n> --attach` (gh 2.99.0+). Files land in `github.com/user-attachments/assets/<id>`, and in private repos only people with repo access can view them.
7. B: T3 Code proxies both `user-attachments` and `blob|raw` URLs through the environment's backend with the user's gh token. Both shapes are handled.
8. B: On desktop the proxy fails today because the bundled runtime fails TLS (#23408). The fix is open PR #23424; the workaround is `launchctl setenv NODE_USE_SYSTEM_CA 1`.
9. B: On the phone, the thumbnail and the tap-to-open preview take different paths. One failing image aborts the whole preview gallery. Which step failed is unverified; the alert's body text tells.
10. B: gh-file-drop cannot be made private for GitHub. GitHub's camo fetches images anonymously, so Cloudflare Access would break github.com, and T3 loads non-GitHub images without credentials.

## A. What makes the generic skill produce a good project skill

### A1. T3 Code's test skills encode what a template would not

- **Use the host's own tools, and stop when they are missing.** "Do not install or switch to another automation system." (`.agents/skills/test-t3-app/SKILL.md:8-11`; `test-t3-mobile/SKILL.md:10-16`). Adopting the Browser and Device panels shrank the web skill from 89 lines (`f7cc776488`) to 41, and PR #12414 removed the simulator skills "they replaced."
- **Isolation rules come from incidents.** PR #4121 exists because the dev runner "could auto-open a browser and consume the bootstrap pairing token before the agent's controlled browser navigated." The rules: never run against `~/.t3/userdata`, never set `VITE_HTTP_URL` (`test-t3-app/SKILL.md:15-18`). AGENTS.md calls these "The three ways to hurt yourself" (lines 59-63). The first is killing by pattern: "Kill only a PID you captured at spawn" (line 61).
- **Readiness comes from output, not defaults.** "Read the real ones from the `[dev-runner]` line since occupied ports shift" (AGENTS.md:83). Setup readiness is a marker file: `.t3/setup-running` names a PID, then `.t3/setup-done` or `.t3/setup-failed` (line 81).
- **Seed with real data.** "An empty database is a bad test." `vp run migrate-dev-db` rebuilds the worktree database "from a read-only snapshot" of the real one, dropping scheduled tasks and auth "so your dev server never runs the developer's agents" (AGENTS.md:91-97). Fixture writes must not "claim backend business behavior works" (`test-t3-app/references/sqlite-fixtures.md:47`). Both helpers have tests, and `t3-sqlite-state` refuses writes to `~/.t3` (PR #4121).
- **Scripts own the fragile steps.** `node scripts/mobile-native-client.ts check|ensure` compares the Expo fingerprint with the installed binary and rebuilds when they differ. It refuses to record a build if "Native inputs changed during verification" (`scripts/mobile-native-client.ts:63-66`), and `check` exits 2 when stale (line 446). PR #11862 explains why: verification "could stop at an outdated development client." `scripts/pair-client.sh` mints a fresh 15-minute credential and opens the pairing deep link.
- **Lifecycle.** "An assistant turn ending is not teardown. Stop only processes you started, using retained terminal sessions or captured PIDs." (`test-t3-app/SKILL.md:35-37`). Only the primary agent runs the integrated pass: "Subagents do not launch their own dev servers." (AGENTS.md:135).
- **Proof type depends on the bug.** Logic bugs get a failing test first; visual bugs get before and after captures. Lint bans sleeps in waits (AGENTS.md:108-117).

### A2. Upstream (cursor/plugins, HEAD `99b609a`)

The skills live at `pstack/skills/create-verification-skill/` and `maintain-verification-skill/`. Since `e5a8186` there is one content change, `c49b37a2c0` (#573, 2026-10-12). Its commit message gives the problem: "A port that answers is not a ready app… database socket up at 3 s and init done at 19 s." The change adds three rules, none of them in our copy:

- Launch "must reach a usable state from an empty data dir, including any migrations and seed data. Ready means usable."
- A journey the seed data cannot satisfy "reports a failure and the reason goes in that feature's `Gotchas`. Never weaken the journey to make it pass."
- A proof run in a stand-in must "list every setup step the stand-in did that the target will not."

`maintain-verification-skill` has not changed since `6714489fa2` (#151). Newer pstack material applies too. The formal-verification skills record "which files and functions each check covers, and the commit at which you last confirmed", and maintenance diffs from that commit; they add "A check that you have never seen fail proves nothing." `principle-build-the-lever` says "Default to building the lever", and `docs/guide/06-verify-and-ship.md` says to "ask for a small control CLI that the skill calls instead."

The PR that created the skills (#150, `e42d29fd5c`) says it was tuned by "4 cloud agents… friction reports drove 6 revisions." That is the author's claim and is unverified.

### A3. Skill-authoring guidance

- **Generic knowledge makes generic skills.** Writing a skill "relying solely on the LLM's general training knowledge" produces "vague, generic procedures". Good source material includes "Code review comments and issue trackers" (agentskills.io best practices, `agentskills/agentskills@69ef37e`). Codex: "Start with one representative task, get it working well, then turn that workflow into a skill" (learn.chatgpt.com/guides/best-practices).
- **Claude Code already ships this loop.** Inference "gets unreliable for projects that need anything beyond a standard launch". `/run-skill-generator` "gets your app running from a clean environment, captures what worked… and commits it as a per-project skill", and Claude edits it "only when it steered a run wrong" (code.claude.com/docs/en/skills#run-and-verify-your-app). Its bundled `/verify` writes `.claude/skills/verify/SKILL.md`, a name clash with our `skills/verify/`.
- **Scripts versus prose.** Anthropic: "Solve, don't defer"; pre-made scripts "Are more reliable than generated code." Match freedom to fragility. Avoid unexplained "voodoo constants" such as timeouts (platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). Codex leans the other way: "Prefer instructions over scripts unless you need deterministic behavior or external tooling" (learn.chatgpt.com/docs/build-skills). Both skill-creators add a script when every run rewrote the same helper (`anthropics/skills@dbd4588 skills/skill-creator/SKILL.md`; `openai/skills@49f948f`).
- **Evaluation.** "Create evaluations BEFORE writing extensive documentation". Test with "Claude B (a fresh instance with the Skill loaded)" and run "At least three evaluations" (Anthropic best practices). skill-creator runs each case with and without the skill and says to "Read the transcripts, not just the final outputs." Its grader warns: "A passing grade on a weak assertion is worse than useless."
- **Progressive disclosure.** Keep SKILL.md "under 500 lines" and "references one level deep". Use domain-specific reference files, one per variant (Anthropic best practices; skill-creator).
- **Recording failures.** "When an agent makes a mistake you have to correct, add the correction to the gotchas section" (agentskills.io). "If you leave the same feedback more than once, codify it" (learn.chatgpt.com/docs/customization/overview).

### A4. App-verification guidance from tool vendors

- **Selectors.** Playwright MCP "Uses Playwright's accessibility tree, not pixel-based input" (`microsoft/playwright-mcp@0c4107a README.md:15`). agent-browser: "snapshot + `@eN` refs are fastest and most reliable" (`vercel-labs/agent-browser@372ac5c skill-data/core/SKILL.md:188`). Maestro recommends `testID` for React Native (docs.maestro.dev).
- **Waits.** "Agents fail more often from bad waits than from bad selectors." (agent-browser `SKILL.md:192`). Playwright: "Never wait for timeout in production." Maestro: "Avoid setting every timeout to 60 seconds."
- **Proof.** Expo: "Screenshot only the correct, fresh build" and "Never assume an existing session or Metro is yours or healthy". On failure, reset and redo "once; a second failure → stop and report" (`expo/skills@d5caf7f plugins/expo/skills/eas-simulator/SKILL.md:200-210`). Expo's troubleshooting table lists "Concrete errors seen while validating this flow, and the fix."
- **Isolation and interface.** agent-browser's default session "is shared with every other agent on the machine" (`SKILL.md:44`). Playwright: "coding agents increasingly favor CLI–based workflows exposed as SKILLs over MCP" (`README.md:9`).

### A5. Proposed changes to `skills/verification-skill/SKILL.md`

| Candidate                                                                                      | Verdict                                                                                                                                                                                                  | Change                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-stack recipe templates                                                                     | Supported, on one condition: Anthropic and skill-creator variant files and Expo's runtime matrix back it, but agentskills warns against generic content                                                      | Add `references/stacks/{ios-simulator,expo-dev-client,nextjs-web,cli}.md`, each listing known traps (stale native client, dev menu covering taps, consumed one-time tokens, port shifts) and the questions to answer. They are not commands to copy. Seed them from verify-lore and verify-visaroy |
| Proof run a second agent replays                                                               | Supported by Anthropic's "Claude B" and skill-creator's baseline runs. Expo uses a separate grader. Upstream only self-proves                                                                              | Change Create step 3: a fresh subagent with only the skill does launch, doctor, one drive and cleanup. Any question it has to ask is a gap in the skill                                                                                                  |
| Record failure modes as they happen                                                            | Supported (agentskills, upstream #573, Expo troubleshooting table). Claude Code edits "only when it steered a run wrong"                                                                                      | Rule: each fix during a run adds a symptom, cause and fix line to that feature's Gotchas in the same run. No run logs                                                                                                                   |
| Helper-script-first                                                                            | Mixed. Anthropic, pstack, Expo and T3 practice support it. Codex prefers instructions                                                                                                                          | Replace "only when the harness cannot express a recipe" with: script the steps that are fragile and deterministic (build compatibility, credentials, seeding, publishing). Scripts are non-interactive, have `--help` and exit codes, and get a test |
| `check` mines PR review comments                                                               | Partly supported (agentskills source material, Codex's "codify" advice). No source uses it for drift                                                                                                       | Record covered paths and a sync commit in each feature file, and have `check` diff from it (pstack formal verification). Mine review threads only as a secondary input                                                                           |

Not on our list, but suggested by the sources: port #573's three rules; add required "Test data" and "Hazards" sections (T3); prefer the host's panels or CLI tools when present (T3, Playwright); have doctor prove a fresh build on the intended device (Expo, T3 fingerprint); allow one reset, then stop (Expo); show each recipe can fail (pstack); evaluate against the hand-grown Lore, Visaroy and work-repo skills as baselines (Anthropic); resolve the `/verify` name clash with Claude Code.

## B. PR evidence for a private repo

### B1. How GitHub renders images in private-repo PRs

- **Camo.** GitHub proxies external images through Camo. An image "served from a private network or from a server that requires authentication… can't be viewed by GitHub" (docs.github.com, About anonymized URLs). Any external host must therefore be anonymously fetchable.
- **Attachments.** "In the case of private and internal repositories, only people with access to the repository can view the uploaded files." Images can be up to 10 MB (docs.github.com, Attaching files).
- **Official upload path.** gh's `--attach` works on `gh pr create|edit|comment` and the issue commands. "You need push access to the repository to attach files." A local path in the body that you also attach is rewritten to the uploaded URL (docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli). It shipped in gh v2.99.0 (2026-09-01); the local `gh` is 2.101.0. It posts to `https://uploads.github.com/user-attachments/assets?name=&content_type=&repository_id=` and gets back `github.com/user-attachments/assets/<id>` (`cli/cli@4f2cfe9 internal/attachments/client.go:105-150`, `client_test.go:143`). I found no REST reference page for this endpoint (unverified absence).
- **Repository files.** In PRs, GitHub documents the form `../blob/main/<path>?raw=true`. It works "for images in a private repository only if the viewer has at least read access" (docs.github.com, Basic writing and formatting syntax). T3 matches only absolute URLs, so keep the absolute `https://github.com/...` form.
- **Release assets.** These upload through documented REST, but inline rendering of a private repo's release-download URL is unverified, and T3's proxy does not match `/releases/download/`.

### B2. T3 Code's media proxy and the phone failure

- **URL shapes** (`packages/source-control-github/src/shared/gitHubMedia.ts:8-55`):
  - `raw.githubusercontent.com` and `media.githubusercontent.com` (LFS) pass through as they are.
  - `github.com/user-attachments/assets/<id>` and the legacy `/<o>/<r>/assets/<n>/<id>` pass through.
  - `github.com/<o>/<r>/(blob|raw)/<path>` is rewritten to `raw.githubusercontent.com/<o>/<r>/<path>`, which drops `?raw=true`.
  - Already-signed `private-user-images` and `objects.githubusercontent.com` links are left alone.
- **Fetch** (`server/gitHubMediaFetch.ts`). The proxy sends `Bearer <gh token>` only to those GitHub hosts. It follows up to three HTTPS redirects without the token, because presigned stores "reject a request that also carries a bearer token."
- **Response** (`apps/server/src/assets/sourceControlMediaResponse.ts`). Only image, video and audio types pass; upstream 4xx passes through. Signed asset tokens live one hour (`AssetAccess.ts:75`). PR #11706, which added the proxy, says private attachments and raw files passed "image expansion" on a real private PR.
- **Desktop failure.** Dhruv's comment on #23408 shows every `GitHubMediaFetch` span failing with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `raw.githubusercontent.com`. PR #23424 (open) adds `--use-system-ca`.
- **Phone, from code.** The thumbnail mints a signed URL once, and `expo-image` loads it (`apps/mobile/src/features/pull-requests/PullRequestMedia.tsx:30-48`). Tapping it opens `FilePreviewModal`, which takes a different path:
  - It re-mints a URL (`refresh: true`, `state/assets.ts:76-94`) for every image in the description's gallery (`PullRequestDescription.tsx:43-54`, `lib/filePreviewGallery.ts`).
  - It opens the viewer only after all of them resolve (`FilePreviewModal.tsx:116-124`).
  - iOS then downloads every item with `URLSession` and requires `QLPreviewController.canPreview` for each (`modules/t3-native-controls/ios/T3NativeFilePresentation.swift:45-70,148-200`).
  - Any single failure shows "Could not open preview". The body names the step. "Reconnect to this environment…" means the re-mint returned nothing (`FilePreviewModal.tsx:46-66`). "The file could not be loaded…" means a download was non-2xx or a file could not be previewed (`FilePreview.ios.tsx:32-35`).
  - `?raw=true` and the extension are not the cause: the query is dropped server-side, and iOS detects the type from the bytes.
  - **Unverified:** which step failed. Candidates: the upstream fetch failing at tap time (#23408), or one gallery sibling failing (a PR with several images). Read the alert body and the backend's `GitHubMediaFetch.fetchMedia` spans at tap time.
- **Markup to avoid.** T3 treats a bare `user-attachments` URL on its own line as video (`packages/client-runtime/src/pullRequestMarkdown.ts:46`), so keep the `![alt](url)` form, which gh writes.

### B3. gh-file-drop

- It is public by design: "**every uploaded file is public to anyone with the URL**" (`juliusmarminge/gh-file-drop@dd9e3b6 README.md:42`). `GET /f/<id>/<name>` is unauthenticated, with an 8-byte random id (`src/worker.ts:221`) and `public, max-age=31536000, immutable` (`src/download.ts:45`).
- Its premise is out of date: "the GitHub API has no attachment upload" (`README.md:3`) predates gh's `--attach`.
- Cloudflare Access needs `CF-Access-Client-Id`/`Secret` headers or a login (developers.cloudflare.com service tokens). Camo sends neither, so github.com breaks.
- T3 sends no credentials for non-GitHub hosts: `pullRequestMediaSource` falls back to `{ uri: url }` (`pullRequestMediaSource.ts:11-18`), so the phone loads the image directly.
- Making it private would need an upstream T3 feature for credentialed custom media hosts, which does not exist. It would still never render on github.com. The only privacy it can offer is an unguessable URL.

### B4. Recommendation for a private work repo, ranked

1. **`gh pr edit <n> --body-file body.md --attach <png>`.** Write `![alt](./.evidence/x.png)` in the body and gh rewrites it. Today it renders on github.com, desktop and phone, for repo members only. It needs no evidence branch, and T3's own AGENTS.md:146 says "Upload PR evidence to GitHub." T3 desktop needs #23424 or the `NODE_USE_SYSTEM_CA` workaround. Opening the full preview on the phone still needs one hands-on test.
2. **Keep the orphan `evidence` branch with absolute `blob/<commit-sha>/…?raw=true` URLs**, pinned to a SHA as #902 already does. It is documented for private repos and handled by T3. It writes to the repo and has the same TLS dependency.
3. **External hosts (gh-file-drop, R2) are not suitable for work data.** No access control survives Camo.

Needs upstream: #23424 merged (desktop TLS). Optional: the T3 mobile preview could open the tapped image when a sibling in the gallery fails. That is a suggestion; it is not confirmed as the phone's cause.

## Sources

- T3 Code `pingdotgg/t3code@5b35402`: `AGENTS.md`; `.agents/skills/test-t3-app/{SKILL.md,references/sqlite-fixtures.md,agents/openai.yaml}`; `.agents/skills/test-t3-mobile/{SKILL.md,scripts/pair-client.sh}`; `scripts/mobile-native-client.ts`; `packages/source-control-github/src/{shared/gitHubMedia.ts,server/gitHubMediaFetch.ts}`; `apps/server/src/assets/{sourceControlMediaResponse.ts,AssetAccess.ts}`; `apps/mobile/src/features/pull-requests/{PullRequestMedia.tsx,PullRequestDescription.tsx,PullRequestMarkdown.tsx,pullRequestMediaSource.ts}`; `apps/mobile/src/components/{FilePreviewModal.tsx,FilePreview.ios.tsx}`; `apps/mobile/src/state/assets.ts`; `apps/mobile/modules/t3-native-controls/ios/T3NativeFilePresentation.swift`; `packages/client-runtime/src/pullRequestMarkdown.ts`; PRs #4121, #11706, #11862, #12414, #23424; issue #23408 — https://github.com/pingdotgg/t3code
- cursor/plugins `c49b37a2c0`, `e5a8186`, HEAD `99b609a` — https://github.com/cursor/plugins/tree/main/pstack/skills
- Anthropic: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices ; https://code.claude.com/docs/en/skills#run-and-verify-your-app ; https://code.claude.com/docs/en/best-practices ; https://github.com/anthropics/skills/tree/dbd4588/skills/skill-creator
- Agent Skills standard: https://agentskills.io/skill-creation/best-practices
- OpenAI: https://learn.chatgpt.com/docs/build-skills ; https://learn.chatgpt.com/guides/best-practices ; https://learn.chatgpt.com/docs/customization/overview ; https://github.com/openai/skills (`49f948f`)
- Expo `expo/skills@d5caf7f`; Playwright MCP `microsoft/playwright-mcp@0c4107a`; https://playwright.dev/docs/locators ; agent-browser `vercel-labs/agent-browser@372ac5c`; Maestro https://docs.maestro.dev (llms.txt)
- GitHub docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls ; https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files ; https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli ; https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
- gh CLI `cli/cli@4f2cfe9` `internal/attachments/client.go`; releases v2.99.0, v2.102.0 — https://github.com/cli/cli/releases
- gh-file-drop `juliusmarminge/gh-file-drop@dd9e3b6` — https://github.com/juliusmarminge/gh-file-drop
- Cloudflare: https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/
- Local: `~/code/skills/skills/verification-skill/SKILL.md`; a private work repo's publish script and PR bodies (not named here)
