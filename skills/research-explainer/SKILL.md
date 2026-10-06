---
name: research-explainer
description: Use when the user wants a topic researched and explained as a learning doc, says "research and explain", "field guide", or "explain this research to me from scratch", or invokes /research-explainer. Researches a technical topic against primary sources via background agents, saves cited findings as Markdown in the repo, then generates a self-contained HTML "field guide" that teaches the concepts from scratch as building blocks.
---

# Research explainer

Two phases, always in this order: research against primary sources, then teach it as a field guide. The output is one or more cited Markdown research docs saved in the repo, and one self-contained HTML page that builds the topic up from zero, block by block, using the user's own project as the running example wherever one exists.

## Phase 1: research (background agents, primary sources)

Split the topic into 1 to 3 independent research threads, with one agent per thread. Hand each thread to a helper agent with the `research` role (read-only), in the background so you keep working while it reads: on Pi or SumoCode spawn role `research`; in Claude Code use the Agent tool (general-purpose); in Codex use the standard subagent. With no helper available, do the research yourself and say so.

Each agent's contract:

1. Investigate against primary sources only: papers (arXiv over blog posts), official docs, and the actual source code of libraries. Follow every claim back to the source that owns it, and cite the original whenever it is reachable, never a summary of it.
2. Write findings to a single Markdown file, one per thread. Every claim carries a citation (a URL, or a file path and line range for code claims). Structure the file as an answers-first summary, per-question findings with citations, an integration sketch for the current repo, and open risks.
3. Save the file where the repo already keeps such notes (`docs/research/` is a common convention). If none exists, create the directory and say where.

While the agents run, prepare Phase 2 by reading the template and the structure reference below.

## Phase 2: field guide (HTML learning doc)

When research lands, generate the explainer. Read both of these before writing HTML:

- [references/structure.md](references/structure.md) holds the document anatomy: hero, "the one idea", building blocks, assembly, cheat sheet, sources, block fixtures, figure catalog, and hard rules.
- One of the bundled templates, picked per the variant notes in structure.md and rotated between generations:
  - [templates/explainer-template.html](templates/explainer-template.html) is the editorial variant, a quiet warm-editorial reading document (Instrument Serif and DM Sans, sidebar TOC, soft cards, per-scheme Mermaid theming).
  - [templates/explainer-template-arcade.html](templates/explainer-template-arcade.html) is the arcade variant, a neo-brutalist game-manual poster (Archivo Black, Atkinson Hyperlegible and Space Mono, sticky tab nav, full-bleed alternating color bands, giant numbered section heads, hard-shadow chips and cards, tilted ribbon callouts, and constant dark schematic panels so figures and Mermaid look identical in both schemes).

  Either way, copy the chosen template's machinery wholesale and replace the placeholder content.

Core principles (details in structure.md):

- Decompose the topic into 3 to 7 self-contained building blocks, ordered so each builds on the previous one. A reader with zero background must be able to read top to bottom without getting lost.
- End every block with an "in our project" callout that uses the user's real incidents, numbers, and file paths from the Phase 1 research. If there is no project context, use one concrete worked example per block instead.
- Give each block one hand-drawn inline SVG (distribution, curve, ladder, scatter, loop; see the figure catalog), which beats prose. Use Mermaid only for the final assembly diagram.
- Give blocks with sharp caveats a "watch out" callout covering calibration warnings, known failure modes, and what the paper does not claim.
- Put takeaways in the prose, the cheat-sheet glossary, and the figures, not in "say it to a friend", "repeat after me", or "TL;DR" blocks.
- Pick a distinctive font pairing and palette per the template's notes. Never use Inter or Roboto, and never use violet-gradient defaults. Support light and dark via `prefers-color-scheme`.

## Delivery

1. Write the HTML to the repo next to the research docs (for example `docs/research/<topic>-explainer.html`) so it ships with the project.
2. Verify before handing over. Open it headless, screenshot the hero, every figure, and the assembly diagram, and check both color schemes. Confirm zero horizontal overflow and that the Mermaid diagram fits at contain zoom (shorten node labels or raise `wrappingWidth` if it crops).
3. Open it in the user's browser and report the file path, the research doc paths, and the block list.

## Review checklist

- [ ] Every research claim in the guide traces to a cited line in a Phase 1 doc
- [ ] Blocks are readable in order by a newcomer, with no forward references
- [ ] Each block runs in this order: question, explanation, figure, project callout, and a watch-out when warranted
- [ ] Cheat-sheet glossary: every term of art gets one honest sentence
- [ ] The sources section links each block to its papers and repos, and also to the repo research docs
- [ ] Both themes are intentional, nothing overflows, and figures are legible at default zoom
