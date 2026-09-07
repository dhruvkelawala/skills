---
name: eli25
description: Explain a topic simply and visually to a software engineer as a neo-brutalist HTML page with big pictures and few words, optionally deployed to Tailscale or Vercel; shown in terminal-browser inside Herdr, otherwise in the user's browser. Use when the user invokes /eli25 or asks for a clear picture explainer that is approachable without being childish.
---

# eli25

Explain like I'm a software engineer who knows general programming but nothing about this specific topic. Big pictures, few words, real terms kept.

Invoke as `/eli25 <topic> [--deploy tailscale|vercel|vercel-work]`. The topic is everything after the invocation that is not a flag. With no `--deploy`, the page is written locally and opened.

## The reader

Knows how to program. Does not know this topic. Wants a mental model first, then enough of the real mechanism to trust it. Keep the technical terms and explain unfamiliar domain terms in plain language the first time. This is not a code review, a field guide, or a reference manual; for that depth, `/research-explainer`.

## Shape

Four panels, in this order, each one screen or less:

1. **What it is.** One sentence, then one figure that is the whole mental model. A reader who stops here should still be right about the topic.
2. **How it works.** Two or three panels, each one mechanism with one figure and at most three sentences. Real names for the parts.
3. **Where it bites you.** The one or two mistakes an engineer new to this makes, stated as what happens and why.
4. **Glossary.** Every domain term used above, one honest sentence each.

Figures are inline SVG, large, and readable at a glance. Mermaid only when a flow genuinely has more than four nodes.

## Style

Neo-brutalist: thick dark borders, hard offset shadows, flat high-contrast colours, oversized heavy typography, blocky layout, little or no border radius. Pick a small palette that fits the topic instead of the same accent every time. Start from the machinery in `research-explainer/templates/explainer-template-arcade.html` in this repo and replace its content; that keeps the two skills visually consistent.

## Theme

Three states: system (default), light, dark. The page follows the OS until the reader picks one, and remembers the pick.

- Define every colour as a token on `:root` for light. Redefine only the tokens under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`, so an explicit choice wins in both directions. The arcade template's dark blocks are media-query only; add the two guards when you copy them.
- A small fixed toggle button in a corner, styled in the same brutalist idiom, cycles system → light → dark and shows the current state with one glyph or word. Three states, not two, so the reader can return to following the OS.
- Persist the choice in `localStorage` under one key, inside try/catch, and apply it from an inline script in `<head>` before the stylesheet paints so there is no flash. Missing or unreadable storage means system.
- Both schemes must pass the render check: figures, borders, and shadows legible in each, and nothing that only exists inside one media block.

## Deliver

1. Write the page to `~/.agent/diagrams/<topic-slug>-eli25.html`. Verify it renders: open headless, check system, light, and dark via the toggle, no horizontal overflow.
2. Show it. Inside Herdr (`test "${HERDR_ENV:-}" = 1`) and with `terminal-browser` on PATH, open the page beside the conversation:

     ```bash
     terminal-browser new-tab ~/.agent/diagrams/<topic-slug>-eli25.html
     ```

     That reuses this terminal tab's browser when one is open and otherwise opens one in a split to the right. Anywhere else (Claude Code, Codex, T3Code, a bare terminal), open the file in the user's default browser with `open` on macOS or `xdg-open` on Linux, even if `terminal-browser` happens to be installed.
3. Publish per `--deploy`, then open the resulting URL the same way, Herdr terminal-browser or the user's browser:
   - **none:** nothing further; the page is already showing.
   - **tailscale:** serve the diagrams directory on the tailnet and report the page URL. Only devices on the tailnet can reach it.

     ```bash
     tailscale serve --bg --set-path /eli25 ~/.agent/diagrams
     host=$(tailscale status --json | jq -r '.Self.DNSName | rtrimstr(".")')
     echo "https://$host/eli25/<topic-slug>-eli25.html"
     ```

     If `/eli25` is already served, the file is live as soon as it is written; do not re-run serve.
   - **vercel:** deploy under the personal Vercel scope. Copy the page to a temp directory as `index.html` and run `vercel deploy --yes` there; report the URL it prints. Anyone with the URL can view it.
   - **vercel-work:** same, with `--scope "$VERCEL_WORK_SCOPE"`. If that variable is unset, run `vercel teams ls`, ask which team once, and tell the user to export it for next time. The team's deployment protection may require a Vercel login to view; say so with the URL.
4. Report the local path, the URL if deployed, where it was opened, and the four panel titles.

**Complete when:** the page passes the render check and the user has a path or URL they can open now.
