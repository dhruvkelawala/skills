---
name: eli25
description: Use for /eli25, or when the user asks to explain a PR, stack, plan, spike, system, incident or concept as a short visual page, to update an explainer, or to deploy one to Vercel. Writes a page in the Field Guide look shaped by its topic and shows it in the thread as a T3 visual page.
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

## 3. Build the page

1. Write `~/.agent/diagrams/<slug>-eli25.html`, where `<slug>` uses lowercase letters, digits and hyphens. When the user asks to update the explainer, edit that same file in place and show it again.
2. Build it in the Field Guide look. Read `../visual-explainer/references/field-guide.md`, then take the parts the page needs from `../visual-explainer/templates/field-guide.html`: its tokens, fonts, plates, chips and cards, not its outline. A short page needs few of them.
3. Follow T3's light or dark mode. T3 gives a visual page its colours as CSS variables but leaves `prefers-color-scheme` unset, so Field Guide's switch cannot see the mode. Drop the Light and Dark switch and its stored choice, keep the dark token blocks, and put this script first in `<head>`:

   ```html
   <script>
     (() => {
       const bg = getComputedStyle(document.documentElement).getPropertyValue("--background");
       if (!bg) return;
       const c = document.createElement("canvas").getContext("2d");
       c.fillStyle = bg;
       c.fillRect(0, 0, 1, 1);
       const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
       document.documentElement.dataset.theme = r * 299 + g * 587 + b * 114 < 128000 ? "dark" : "light";
     })();
   </script>
   ```

   The script picks dark when the thread's background is dark. Outside T3, as on a Vercel deploy, it does nothing and the page follows the system scheme. Paint the page ground with `var(--background, var(--bg))`, so it matches the thread in T3 and stays bone elsewhere.
4. Where `html_render`'s description and Field Guide differ, follow `html_render`. It owns the frame's width, height and ground.
5. Run `../unslop/SKILL.md` on the page's prose last. Keep the page's shape and word budget, and leave code as it is.

**Done when** the file holds a Field Guide page with the script first in `<head>` and no theme switch, and unslop has run on its prose.

## 4. Preview and show

1. Preview the page with `html_preview` in light and in dark, at 728 pixels and at 390 for a phone. Fix every console error and anything wider than the frame. Look at each screenshot: the light one is light, the dark one is dark, and every label reads. Check that the prose fits the word budget and that each heading reads as a claim.
2. Show it with `html_render`, at the `contentHeight` the 728-pixel preview reported. Open no local browser: the page lives in the thread, where the user reads it on any device. Your reply adds only what the page does not say.

**Done when** `html_render` has shown the page in the thread.

## 5. Deploy on request

Deploy only when the user asks, for a page meant for a teammate. The user names the target in plain words, now or in a later message. The commands are in `references/deploy.md`.

| The user says | Target |
| --- | --- |
| "argentlabs vercel", "work vercel", "company vercel" | Vercel, work scope |
| "personal vercel", "my vercel" | Vercel, personal scope |
| "vercel" alone | Work scope for an argentlabs repo, personal scope otherwise |

Report each URL as a plain URL on its own line.

**Done when** the user has the URL.
