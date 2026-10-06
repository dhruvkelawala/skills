---
name: eli25
description: Use for /eli25, or when the user asks to explain a PR, stack, plan, spike, system, incident or concept as a short visual page, to update an explainer, or to host one on Tailscale or Vercel. Writes a neo-brutalist HTML page shaped by its topic and shows it in terminal-browser inside Herdr, the user's browser elsewhere, or a tailnet URL over ssh.
---

# eli25

An eli25 page explains the user's own work in progress to an engineer who can program but has not seen this topic. The reader judges it by eye, so it leads with big figures, runs to about 400 words, and states every claim in plain English.

Invoke as `/eli25 <topic>`. The topic can be a PR number, a stack, a plan file, a spike, or a phrase. With no topic, explain the work in this conversation.

## 1. Pick the shape

Read the source first: the diff and PR body, the plan file, the code, the measurements. Then pick the row for what the reader must understand after reading. Each cell names a section's job, not its title.

| Topic | Sections, in order |
| --- | --- |
| PR or stack | Before and after. One real request traced through the change. One "Not in this change" line. A review route of three to six files to read in order, ending with "Next: `/pr-review <PR>`". A stack gets one before-and-after block per PR in stack order, then one route. |
| Plan | Today versus target. Build order. Open decisions. The next action and what is left. |
| System | A picture of the parts. One worked example through them. |
| Spike or assessment | What was measured and what was assumed. The recommendation. The next action and what is left. |
| Incident | Timeline. Cause. Fix. How to spot it next time. |
| Concept | The mental model. An example. The common misconception, if a real one exists. |

**Done when** you can name the row, the sections, and the one real example the page will trace, with its real names and numbers.

## 2. Write the page

- **Opener.** One sentence and one figure that hold the whole model. A reader who stops there is still right about the topic.
- **Claim titles.** Each section title states what the section shows, as in "One thread, one notebook" or "The app checks every ticket the model cites".
- **Figures.** Pick each one by what it shows, and use the smallest view that makes the point: a call tree for runtime flow, a sequence for messages between parts, a file tree for ownership, a box diagram for the parts of a system, and a before and after or a diff sketch (a call tree, file tree or state with added and removed lines) for a change. A section gets a figure only when a picture makes its point faster than words. Put each figure next to the two or three sentences it supports, inside a `<figure>` element.
  - Draw diagrams as inline SVG with a viewBox about 480 units wide and labels of 13 units or more, so they stay readable on a phone. Lists of steps or cards can be HTML boxes that stack on narrow screens instead.
  - Set trees and diff sketches in a `<pre>` on the figure panel, with lines under 40 characters.
  - Use Mermaid only for a flow with more than four nodes.
- **Terms.** Gloss each real term in plain words in the sentence that first uses it. Add a glossary only for terms the page uses three or more times.
- **Misconceptions.** Include one only when engineers really make that mistake, as one sentence beside the mechanism it concerns. Scope notes go in the single "Not in this change" line.
- **Length.** About 400 words of prose, counting captions but not figure labels, plus about 100 for each extra PR in a stack. When the user asks for detail, write a linked second page, `<slug>-eli25-detail.html`, and keep the first page short.
- **Ending.** A plan or spike ends with one next action concrete enough to run, then a short list of what is left.

Prose rules:
- Put the claim first, then the evidence.
- Write short active sentences with a named actor: "The watcher polls GitHub every minute."
- Write whole sentences with their articles and verbs. Where an arrow would go, write the verb it stands for.
- Use plain words and literal statements. Taglines, metaphor chains, em dashes, en dashes, text arrows, and "What happens" and "Why it fails" templates make a page stiff.

Before and after, from `support-report-pr-349-eli25.html`:

> Before. **Meaning stays behind a lock.** Configured Jira projects and archived QA/release Slack channels only. Startup checks every Slack source exists and is accessible; collection then scrubs fixed credential formats [...] and caps size.
>
> After. **The model reads the messages, and the app decides what gets posted.** The report reads two things: Jira tickets, and last week's messages from the QA and release Slack channels. Before it reads anything, it checks that every channel exists and that the bot can open it. Then it strips anything that looks like a password or token, keeps only Monday to Sunday, and cuts the pile to a fixed size.

**Done when** the page has its opener, every section of the shape sits under a claim title, and a plan or spike ends on one next action.

## 3. Build and check

1. Write `~/.agent/diagrams/<slug>-eli25.html`, where `<slug>` uses lowercase letters, digits and hyphens. When the user asks to update the explainer, edit that same file in place, so the open tab and any deployed URL show the new version.
2. Start from `research-explainer/templates/explainer-template-arcade.html` in the sibling skill folder and replace its content. Keep its neo-brutalist look: thick dark borders, hard offset shadows, flat high-contrast colours, oversized heavy type, square corners, and figures on the fixed dark panel. Give each topic its own small palette by swapping the accent hexes. Drop template parts the shape does not use.
3. Give the page three theme states: system by default, then light, then dark.
   - Define every colour as a token on `:root` for light. Redefine only the tokens under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`, so an explicit pick wins in both directions. The template's dark blocks are media-query only, so replace them.
   - A small fixed `#theme-toggle` button in a corner, in the same brutalist style, cycles from system to light to dark and back to system, and shows the current state as a word.
   - Store the pick in `localStorage` under `eli25-theme` inside try and catch, and apply it from an inline script at the top of `<head>`, before any stylesheet, so the page never flashes. Missing or unreadable storage means system.
   - `references/theme.html` has the code for all three.
4. Run `node <this skill's folder>/references/render-check.mjs ~/.agent/diagrams/<slug>-eli25.html`. It loads the page in headless Chrome at 1280 and 390 pixels in system light, system dark, and each explicit pick. It fails on horizontal overflow, a broken toggle, an explicit pick that loses to the OS, a script error, or a dash, arrow or curly quote in the text. It prints the prose word count and headings and saves screenshots. Fix every failure and run it again.
5. Look at the light and dark screenshots at 1280 pixels.

**Done when** the render check passes, the prose word count is within the budget, every printed heading reads as a claim, and both screenshots look right to you.

## 4. Deliver

Show the page:
- Inside Herdr (`HERDR_ENV=1`) with `terminal-browser` on PATH, run `terminal-browser new-tab <path>`. It reuses this tab's browser or opens one in a split.
- Over ssh (`SSH_CONNECTION` set), a browser would open on the remote machine where nobody sees it. Unless the user named another target, serve the page on the tailnet and print its URL instead.
- Anywhere else, open it in the user's own browser with `open` on macOS or `xdg-open` on Linux, even when terminal-browser is installed.

Deploy when the user names a target in plain words, now or in a later message. The commands are in `references/deploy.md`.

| The user says | Target |
| --- | --- |
| "tailscale", "my tailnet" | Tailscale serve, reachable only on the tailnet |
| "argentlabs vercel", "work vercel", "company vercel" | Vercel, work scope |
| "personal vercel", "my vercel" | Vercel, personal scope |
| "vercel" alone | Work scope for an argentlabs repo, personal scope otherwise |

A deploy of a page that already passed the render check skips the check, and the URL needs no test fetch.

Report the local path and each URL as a plain URL on its own line, where the page opened, and the section titles.

**Done when** the user has a path or URL they can open now.
