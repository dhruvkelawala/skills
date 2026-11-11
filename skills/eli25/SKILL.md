---
name: eli25
description: Use for /eli25, or when the user asks to explain a PR, stack, plan, spike, system, incident or concept as a short visual page, or to update an explainer. Also use unasked after a review intro or a recap whose PR adds a part, changes a flow across parts, or is a stack, and when the user still doesn't get a chat answer. Writes a page of about 400 words in the Field Guide look and shows it in the thread as a T3 visual page.
---

# eli25

An eli25 page explains the user's own work in progress to an engineer who can program but has not seen this topic. The reader judges it by eye, so it leads with big figures, runs to about 400 words, and states every claim in plain English.

Invoke as `/eli25 <topic>`. The topic can be a PR number, a stack, a plan file, a spike, or a phrase. With no topic, explain the work in this conversation.

A page comes without asking in two cases. After the intro of a review or a recap, make one when its PR adds a part, changes a flow across parts, or is a stack. When the user says they still don't get a chat answer, the page is the next try. Every other answer stays in chat.

## 1. Pick the shape

Read the source first: the diff and PR body, the plan file, the code, the measurements. Then pick sections for what the reader must understand after reading. The rows are suggestions, and each cell names a section's job, not its title. Merge, reorder or drop sections to fit the topic.

| Topic | Sections that usually work |
| --- | --- |
| PR | Before and after. One real request traced through the change. One "Not in this change" line. |
| Stack | One before-and-after block per PR, bottom first. Then one request traced through the stack and one "Not in this change" line. |
| Plan | Today versus target. Build order. Open decisions. The next action and what is left. |
| System | A picture of the parts. One worked example through them. |
| Spike or assessment | What was measured and what was assumed. The recommendation. The next action and what is left. |
| Incident | Timeline. Cause. Fix. How to spot it next time. |
| Concept | The mental model. An example. The common misconception, if a real one exists. |

A PR or stack page always has its three parts and ends on the "Not in this change" line, because the review tour gives the files to read.

**Done when** you can name the sections and the one real example the page will trace, with its real names and numbers.

## 2. Write the page

- **Opener.** One sentence and one figure that hold the whole model. A reader who stops there is still right about the topic.
- **Headings.** Each heading is one plain sentence, with a subject and a verb, that states what its section shows: "The app checks every ticket the model cites", or "A verdict stays valid until the diff changes" where a first draft had the slogan "A verdict covers the patch, not the commit". Field Guide's serif italic tail stays off eli25 headings.
- **Figures.** Pick each one by what it shows, and use the smallest view that makes the point: a call tree for runtime flow, a sequence for messages between parts, a file tree for ownership, a box diagram for the parts of a system, and a before and after or a diff sketch (a call tree, file tree or state with added and removed lines) for a change. A section gets a figure only when a picture makes its point faster than words. Put each figure next to the two or three sentences it supports, inside a `<figure>` element.
  - Draw diagrams as inline SVG with a viewBox about 480 units wide and labels of 13 units or more, so they stay readable on a phone. Lists of steps or cards can be HTML boxes that stack on narrow screens instead.
  - Set trees and diff sketches in a `<pre>` inside a plate, with lines under 40 characters.
  - Use Mermaid only for a flow with more than four nodes.
- **Terms.** Gloss each real term in plain words in the sentence that first uses it. Add a glossary only for terms the page uses three or more times.
- **Misconceptions.** Include one only when engineers really make that mistake, as one sentence beside the mechanism it concerns. Scope notes go in the single "Not in this change" line.
- **Length.** About 400 words of prose, counting captions but not figure labels, plus about 100 for each extra PR in a stack. When the user asks for more detail than that, make the long page with visual-explainer and keep this one short.
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

**Done when** the page has its opener, its prose runs to about 400 words, every section sits under a heading that is a plain sentence, and a plan or spike ends on one next action.

## 3. Build the page

1. Write `~/.agent/diagrams/<slug>-eli25.src.html`, where `<slug>` uses lowercase letters, digits and hyphens. When the user asks to update the explainer, edit that same source in place, render it again and show it again.
2. Build it in the Field Guide register, from the `visual-explainer` folder in your skills directory. Read its `references/kit.md` and `references/field-guide.md`; its `templates/field-guide.src.html` shows every part. Take the parts the page needs, such as the field note, plates, chips and specimen cards, not the outline. A short page needs few of them. Leave out `data-register`, so the page gets Field Guide.
3. Where `html_render`'s description and Field Guide differ, follow `html_render`. It owns the frame's width and height.
4. Run `../unslop/SKILL.md` on the page's prose. Keep the page's shape and word budget, and leave code as it is.
5. Render it with `node <visual-explainer folder>/kit/render.mjs ~/.agent/diagrams/<slug>-eli25.src.html --t3`, and fix every `✗` it lists in the source. It writes `<slug>-eli25.html` beside the source. The renderer adds the kit and the script that follows T3's light or dark mode, and leaves out the Light and Dark switch in T3, so the source holds neither.

**Done when** the source renders with no `✗` and unslop has run on its prose.

## 4. Preview and show

1. Preview the page with `html_preview` in light and in dark, at 728 pixels and at 360 for a phone. Fix every console error and anything wider than the frame. Look at each screenshot: the light one is light, the dark one is dark, and every label reads. These checks replace Field Guide's T3 delivery check, and its other checks still apply.
2. Show it with `html_render`. Set its height to the `contentHeight` of the 360-pixel preview, because T3 uses the height only on phones, which are about 360 pixels wide. Open no local browser: the page lives in the thread, where the user reads it on any device.

**Done when** `html_render` has shown the page in the thread.

## Optional publishing

When the user asks to publish the page on Vercel, hand the rendered HTML path and their requested target to [vercel-deploy](../vercel-deploy/SKILL.md). It owns deployment and account selection. A request to deploy an existing page starts there.

**Done when** the requested deployment has returned its URL.
