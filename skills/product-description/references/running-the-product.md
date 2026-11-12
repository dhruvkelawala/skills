# Running the product

How to bring up the product for verification without disturbing the user's own work, and the traps hit so far. Add a trap here when a run hits a new one.

## Ground rules

- Run from a clean clone of the target commit in a run folder (for example `~/.agent/verify/<product>/product-description-<sha>/src`), never from the user's checkout: it may hold uncommitted work, sit on another branch, or have local `main` behind or diverged from the remote.
- Use the repo's own launch recipe when it has one (a `verify-*` skill under `.agents/skills/`, `EVIDENCE.md`, a launcher script). Read its feature map before driving, but trust the code over the recipe where they disagree: recipes go stale.
- Use the pinned toolchain the repo declares (`.nvmrc`, `packageManager`, `.xcode-version`). Install a different package manager version into the run folder rather than changing the machine's.
- Check that every port the recipe uses is free before launching; another project's dev server or bundler may already hold the default.
- One agent drives the product at a time. Drafters and reviewers read code and tests.
- Use invented users and data, and the repo's fixtures. Never drive production, a real account, a physical device, or real messages, photos or documents.
- Keep evidence (screenshots, logs, traces) in the run folder, outside the description repo. Run the recipe's cleanup at the end.

## Web apps

- Launch an owned dev server bound to localhost on its own port, with model, database and analytics credentials blank and the repo's test auth bypass on, as its recipe describes. Run its doctor or health check before driving.
- Model-backed routes then answer with fixed fallbacks. Mock them at the browser seam (`page.route`) to observe how the screen handles a known response; that settles the screen's handling, not what a model would say.
- Without a database, anonymous sign-in may fail; the test token usually stands in for it.

## iOS apps (Expo or React Native)

- **CocoaPods needs a UTF-8 locale.** Export `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before `pod install` or the repo's `pods` script. Without it, CocoaPods fails with "Unicode Normalization not appropriate for ASCII-8BIT".
- **Keep the simulator alive after the build.** Building with a pinned Xcode that is not the machine's default can restart the simulator service, leaving the owned simulator shut down. Check it is `Booted` before installing; if not, boot it again and continue from the install step. The build does not need repeating.
- Create a fresh simulator named for the run, record what the run made (simulator, derived data, driver state, bundler PID), and let cleanup delete exactly that.
- Some test helpers do not work in a background agent session. An Apple Vision OCR helper used to read a share extension's screen can hang for good; drive the share extension with the device driver and read screenshots instead, and record the affected tests as blocked, not failed.
- Some checks need setup a fresh simulator lacks: a widget placed on the Home Screen by hand, a second keyboard language, a Release build for cold launches from a link or widget. Do the setup, or record the rows as blocked with the reason.
- An end-to-end runner may insist its output folder sits inside its own project; point it at an ignored folder there.

## Recording results

Write `pass`, `fail` or `blocked` with the device, the date and how, for example `pass (simulator, 2026-11-11, poster opened from its row)`. A suspected defect that reproduces is `pass, defect reproduced (…)`. A test that could not run for an environment reason is `blocked`, never `fail`. Automated and scripted results alone never make a document `verified`.
