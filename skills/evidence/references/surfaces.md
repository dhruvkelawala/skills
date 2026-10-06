# Capture recipes by surface

Pick the recipe for the surface, prefer tools the repo already depends on, and put the adapted command into `EVIDENCE.md`. Every recipe writes files to `.evidence/` in the checkout, which git ignores, named `<criterion-slug>-<what>.<ext>`. `publish-evidence.sh` copies them to the evidence branch.

Use a still for a state, a recording for a flow, a transcript for a command or API, and a before and after pair for a change to existing behaviour. Pick the lightest form a reviewer would accept as seeing the feature work.

## Who drives the surface

There are three tiers, in order. `EVIDENCE.md` records the tier for each surface so later runs do not decide it again.

1. **The repo's own harness.** Playwright or Cypress specs, Maestro flows, XCUITests, a demo or fixture script, or an eval runner. A reviewer can rerun it with one command, and it produces the same capture at any HEAD.
2. **Computer-use**, when the host has it and no harness covers the surface. Examples are Claude Code with the Chrome extension, or a model with computer use in Pi, Hermes or Codex. It suits native desktop and mobile apps without flows, third-party dashboards the change writes into, and exploring before the capture. The capture is still a screenshot or recording made with the surface's capture command below, and the reproduce line becomes a numbered list of the steps taken. Drive a local build at HEAD, never a deployed environment, so the capture shows the change.
3. **A manual capture command**, as the fallback. The agent runs the surface, performs the steps itself through whatever it can, and records with the platform tool.

Prefer a harness to computer-use even when the model drives well, because a reviewer can rerun the harness. Prefer computer-use to writing a throwaway harness for a one-off capture.

## Web UI

When the repo has Playwright, write a one-off script or use an existing spec with `page.screenshot({ path, fullPage: true })` and `recordVideo` in the browser context. Run it headless against the dev server.

```bash
npx playwright test e2e/<flow>.spec.ts --reporter=line
# or a scratch script
npx playwright screenshot --viewport-size=1280,800 http://localhost:3000/<route> .evidence/<slug>-after.png
```

Inside Herdr, run `terminal-browser open http://localhost:3000/<route>`, then `terminal-browser action -- screenshot .evidence/<slug>.png`. In Claude Code with the Chrome extension, take a `claude-in-chrome` screenshot. Otherwise use Playwright.

For before and after, capture the same route with the same viewport at `base_sha`, in a second worktree, and at HEAD. Then place them side by side:

```bash
ffmpeg -i .evidence/<slug>-before.png -i .evidence/<slug>-after.png -filter_complex hstack .evidence/<slug>-compare.png
```

## Mobile (Expo, React Native or native iOS)

Launch on a booted simulator, drive with Maestro when the repo has flows or with the agent's own taps when it does not, and capture with simctl:

```bash
xcrun simctl io booted screenshot .evidence/<slug>-after.png
xcrun simctl io booted recordVideo --codec h264 .evidence/<slug>-flow.mp4   # Ctrl-C to stop
maestro test .maestro/<flow>.yaml   # when the repo has flows; Maestro saves screenshots per step
```

On Android, use `adb exec-out screencap -p > .evidence/<slug>.png` and `adb shell screenrecord /sdcard/x.mp4`. Keep recordings under 30 seconds, and trim them with `ffmpeg -ss <start> -to <end> -c copy`.

## Desktop app (macOS)

Build and run, then capture the window rather than the whole screen:

```bash
screencapture -l "$(osascript -e 'tell app "System Events" to id of first window of (first process whose name is "<App>")')" .evidence/<slug>.png
screencapture -v -V 10 .evidence/<slug>.mov   # 10-second recording
```

For an app with XCUITests, `XCTAttachment` screenshots are saved in the `.xcresult`. Export them with `xcrun xcresulttool export`.

## Terminal UI

Record the real terminal session, then render to a shareable file:

```bash
asciinema rec .evidence/<slug>.cast -c '<command that opens the TUI>'
agg .evidence/<slug>.cast .evidence/<slug>.gif      # or vhs with a .tape script for a scripted demo
```

A TUI with a DOM or headless renderer in the repo, as some Pi extensions have, can use its Playwright screenshot path instead, because the repo's own harness comes first. A plain text dump of the final frame is acceptable for a state, not for a flow.

## CLI

The evidence is a transcript of a real run at HEAD, with the exact command, its stdout and stderr, and its exit status.

```bash
{ echo "\$ <command>"; <command>; echo "exit=$?"; } 2>&1 | tee .evidence/<slug>.txt
```

For before and after, run the same command at `base_sha` and at HEAD and keep both transcripts. Trim each to the lines that show the difference, and keep the command and exit lines.

## HTTP or RPC API

Capture the request and the response verbatim, with each secret replaced by its variable name:

```bash
curl -sS -i -X POST http://localhost:<port>/<path> -H 'content-type: application/json' -d @fixture.json | tee .evidence/<slug>-response.txt
```

Include the fixture body. For streaming or websocket APIs, capture a bounded transcript with timestamps.

## Library

Run the smallest real example that exercises the change, such as an example script, a REPL session or a doc snippet, and keep its transcript as for a CLI. A library whose only consumer is its tests is the one valid exemption. State it in `EVIDENCE.md`.

## Background worker or job

Trigger it once and capture the outcome: a bounded set of the log lines it wrote, and a query that shows the state it changed, run before and after.

## Chat bot or messaging integration (Slack, Discord, Telegram, email)

The evidence is the conversation as the user sees it. Run the bot locally against a test workspace or channel named in `EVIDENCE.md`, send the triggering message, and capture both:

```bash
# the bot's actual reply, verbatim, via the platform API (mask tokens by variable name)
curl -sS -H "Authorization: Bearer $SLACK_BOT_TOKEN" "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$THREAD_TS" \
  | jq '.messages[] | {user, ts, text}' | tee .evidence/<slug>-thread.json
```

Also take a screenshot of the thread in the client, through computer-use or a browser, so formatting, blocks and reactions are visible. For scheduled or event-driven posts, capture the trigger, such as the event payload or the cron tick in the logs, beside the resulting message.

## Agent or LLM behaviour

When the change alters what an agent does or says, tests alone cannot show it. The evidence is an eval run and a sample:

```bash
pnpm run eval:<suite> 2>&1 | tail -20 | tee .evidence/<slug>-eval.txt     # scores and pass counts at HEAD
```

Add one real, trimmed transcript of the changed behaviour, with the prompt or trigger and the agent's output, from the eval or a live local run. For before and after, run the same eval at `base_sha` and at HEAD and show the scores side by side. Run a paid eval only when `EVIDENCE.md` allows it for that suite.

## Observability change

For a change to tracing, metrics or dashboards, the evidence is the signal arriving. Take a screenshot of the trace or panel in the local Grafana or its equivalent, with the identifying field, such as a run ID or trace ID, visible and matching the transcript of the action that triggered it.

## Publishing

```bash
bash <skill-dir>/scripts/publish-evidence.sh --repo <owner/name> --label <issue-or-branch> .evidence/*
```

The script prints one link per file in the form `https://github.com/<owner>/<repo>/blob/evidence/<label>/<timestamp>/<file>?raw=true`, which renders in PR bodies for anyone with access to the repository. Paste the links under the PR's Evidence blocks with the HEAD SHA they were captured at.
