# Capture recipes by surface

Pick the recipe for the surface, prefer tools the repo already depends on, and put the adapted command into `EVIDENCE.md`. Every recipe yields files under `.evidence/` in the checkout (git-ignored) named `<criterion-slug>-<what>.<ext>`; `publish-evidence.sh` moves them to the evidence branch.

Stills prove a state. Recordings prove a flow. Transcripts prove commands and APIs. Before/after pairs prove a change to existing behaviour. Pick the lightest form that a reviewer would accept as seeing it work.

## Web UI

Repo has Playwright: write a one-off script or use an existing spec with `page.screenshot({ path, fullPage: true })` and `recordVideo` in the browser context. Run headless against the dev server.

```bash
npx playwright test e2e/<flow>.spec.ts --reporter=line
# or a scratch script
npx playwright screenshot --viewport-size=1280,800 http://localhost:3000/<route> .evidence/<slug>-after.png
```

Inside Herdr: `terminal-browser open http://localhost:3000/<route>` then `terminal-browser action -- screenshot .evidence/<slug>.png`. In Claude Code with the Chrome extension: `claude-in-chrome` screenshot. Otherwise Playwright.

Before/after: capture the same route at `base_sha` (a second worktree or `git stash`) and at HEAD, same viewport, and place them side by side:

```bash
ffmpeg -i .evidence/<slug>-before.png -i .evidence/<slug>-after.png -filter_complex hstack .evidence/<slug>-compare.png
```

## Mobile (Expo / React Native / native iOS)

Launch on a booted simulator, drive with Maestro when flows exist, else by hand through the agent's own taps, and capture with simctl:

```bash
xcrun simctl io booted screenshot .evidence/<slug>-after.png
xcrun simctl io booted recordVideo --codec h264 .evidence/<slug>-flow.mp4   # Ctrl-C to stop
maestro test .maestro/<flow>.yaml   # when the repo has flows; Maestro saves screenshots per step
```

Android: `adb exec-out screencap -p > .evidence/<slug>.png`, `adb shell screenrecord /sdcard/x.mp4`. Keep recordings under 30 seconds; trim with `ffmpeg -ss <start> -to <end> -c copy`.

## Desktop app (macOS)

Build and run, then capture the window rather than the whole screen:

```bash
screencapture -l "$(osascript -e 'tell app "System Events" to id of first window of (first process whose name is "<App>")')" .evidence/<slug>.png
screencapture -v -V 10 .evidence/<slug>.mov   # 10-second recording
```

For an app with XCUITests, `XCTAttachment` screenshots land in the `.xcresult`; export with `xcrun xcresulttool export`.

## Terminal UI

Record the real terminal session, then render to a shareable file:

```bash
asciinema rec .evidence/<slug>.cast -c '<command that opens the TUI>'
agg .evidence/<slug>.cast .evidence/<slug>.gif      # or vhs with a .tape script for a scripted demo
```

A TUI with a DOM or headless renderer in the repo (as some Pi extensions have) can use its Playwright screenshot path instead; prefer the repo's own harness. A plain text dump of the final frame is acceptable for a state, not for a flow.

## CLI

A transcript is the evidence: the exact command, its stdout and stderr, and its exit status, captured from a real run at HEAD.

```bash
{ echo "\$ <command>"; <command>; echo "exit=$?"; } 2>&1 | tee .evidence/<slug>.txt
```

Before/after: the same command at `base_sha` and at HEAD, two transcripts. Trim to the lines that show the difference; keep the command and exit line.

## HTTP or RPC API

Capture the request and response verbatim, with secrets masked by variable name:

```bash
curl -sS -i -X POST http://localhost:<port>/<path> -H 'content-type: application/json' -d @fixture.json | tee .evidence/<slug>-response.txt
```

Include the fixture body. For streaming or websocket APIs, capture a bounded transcript with timestamps.

## Library

Run the smallest real example that exercises the change (an example script, a REPL session, a doc snippet) and keep its transcript, as for a CLI. A library whose only consumer is its tests is the one legitimate exemption; state it in `EVIDENCE.md`.

## Background worker or job

Trigger it once and capture the observable outcome: the log lines it emitted (bounded), and the state it changed shown by a query before and after.

## Publishing

```bash
bash <skill-dir>/scripts/publish-evidence.sh --repo <owner/name> --label <issue-or-branch> .evidence/*
```

Prints one link per file in the form `https://github.com/<owner>/<repo>/blob/evidence/<label>/<timestamp>/<file>?raw=true`, which renders in PR bodies for anyone with access to the repository. Paste those under the PR's Evidence blocks with the HEAD SHA they were captured at.
