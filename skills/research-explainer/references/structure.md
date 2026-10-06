# Field guide structure

The document anatomy for research-explainer output. The template implements all CSS classes named here.

## Document skeleton (in order)

| Section | TOC id | Purpose |
|---|---|---|
| Hero | none | doc-id line, serif headline (one italic accent phrase), mono subtitle, lead paragraph stating the single thesis the whole doc builds toward |
| The one idea | `s0` | The framing that makes everything else obvious. Include a 3-step `mini-pipe` (horizontal cards) mapping the blocks to jobs, and a callout stating the governing rule or principle |
| Building blocks | `s1…sN` | 3 to 7 concept sections, each self-contained (anatomy below) |
| Assembly | none | One Mermaid diagram showing how the blocks compose into the real system, each node labeled with its block number; follow with a callout on why the composition compounds |
| Cheat sheet | none | Glossary table with a `term` column (mono, accent color) and one honest plain-language sentence each. Every term of art used anywhere in the doc must appear |
| Sources | none | Per-block source list: papers (arXiv links), repos, and the repo-relative paths of the Phase 1 research docs and data |
| Closing line | none | One mono footer line saying what this doc is and what it feeds into |

## Block anatomy

Each building block, strictly in this order:

1. Section head. Use `sec-head` with a `BLOCK N` chip and a serif title that names the concept in plain words ("Why models repeat themselves", not "Mode collapse").
2. The question. One italic serif line with the concrete question this block answers, phrased from the reader's world ("We asked for creative output at temperature 1. Why did we get the same answer five times?").
3. Explanation prose. Two or three short paragraphs in the `prose` class. Build from zero: define every term at first use and bold the term (`<b>` renders accent-colored). Prefer mechanism over assertion, and say why the thing happens.
4. Figure. One `fig` card with an inline SVG (catalog below) and a `figcaption` that adds information and does not repeat the prose.
5. Project callout. `callout callout--ours`, titled "In our pipeline" or "In our project", holding the user's real incident, metrics, thresholds, costs, and file paths that this block explains. This is what makes the doc theirs.
6. Watch-out callout (only when warranted). `callout callout--warn` with the sharp edge: what is not claimed, calibration caveats, failure modes, and what experiment gates it.

Add no "say it to a friend", "repeat after me", "TL;DR", or "key takeaway" boxes. The prose, figure, and cheat sheet carry the takeaways.

## Figure catalog (inline SVG, themed via CSS classes)

Pick the shape that matches the concept; all classes exist in the template:

| Concept shape | Figure | Classes |
|---|---|---|
| Distribution, or where mass concentrates | one or two bell curves, mode marked with dashed drop-line, area filled | `s-curve`, `s-curve--dim`, `s-fill`, `s-fill-gold`, `s-dash` |
| Sampling or selection from a space | curve or scatter with highlighted dots and labels | `s-dot`, `s-dot-gold`, `s-dot-dim` |
| Ceiling or diminishing returns | rising curve flattening under a dashed limit line, annotated regions | `s-curve`, `s-dash-red`, axis via `s-axis` |
| Ranking or band placement | horizontal rungs, a candidate dot, and arrows with verdicts | `s-rung`, `s-arrow` (needs the `#arr` marker def), `s-text-green` and `s-text-red` |
| Similarity or clustering | 2D scatter, near-duplicates ringed dashed-red, selections ringed green | `s-ring-red`, `s-ring-green` |
| Loop or feedback cycle | 4 rounded boxes (`s-box`) in a cycle with arrows, numbered steps |
| System composition | Mermaid `graph TD` in the zoomable `diagram-shell` (assembly section only) |

SVG rules:
- Use a `viewBox` about 720 wide.
- Put text in `s-text*` classes (mono, themed).
- Keep labels short enough to fit the viewBox, and check for clipping.
- Style every text and element with the CSS classes, never hardcoded colors, because hardcoded colors break the themes.
- Add `role="img"` and an `aria-label`.

## Aesthetics

- Rotate between the two bundled template variants across generations, and pick to fit the audience.
  - Editorial (`templates/explainer-template.html`) is a quiet reading document. The warm-editorial default uses Instrument Serif, DM Sans, and JetBrains Mono with cream, terracotta, ochre, and sage. It has a sidebar TOC, soft-bordered cards, and Mermaid re-themed per color scheme. It is best for calm deep-reading docs. Re-skins that hold up: deep-navy and gold editorial, paper and ink with sage, and a real IDE palette (Nord, Gruvbox).
  - Arcade (`templates/explainer-template-arcade.html`) is a loud game-manual poster. It uses Archivo Black display, Atkinson Hyperlegible body, and Space Mono, with full-bleed bands alternating cream, coal, and periwinkle and coral, yellow, and green accents. It has a sticky top tab nav, giant coral section numbers with a band-colored text-stroke, and chips and cards with 2 to 3 px hard borders and offset shadows. The "In our project" and "Watch out" callouts are tilted green and coral ribbons. Figures and the Mermaid assembly always sit on a constant dark panel with a yellow frame, so all SVG and Mermaid colors are identical in light and dark schemes (only band backgrounds flip). It is best for plans, reviews, and topics that benefit from energy. Keep band rotation strict (paper, coal, blue, then repeat) and never place two same-color bands adjacent.
  - Variant-specific checks for arcade: the top nav is the only intentional horizontal scroller, so `document.documentElement.scrollWidth` must still equal `clientWidth`. `<b>` inside `.band--blue` prose renders as a yellow highlight, so keep bolded runs short there.
- Forbidden in every variant: Inter or Roboto as body text, violet or indigo accents, gradient heading text, glowing shadows, and emoji section icons.
- Provide light and dark palettes via `prefers-color-scheme`, and set Mermaid theme colors from the same palette in both modes (the template shows the `isDark` and `themedSource` pattern).

## Verification (before handing over)

1. Headless-open the file and screenshot the hero, every `.fig`, the assembly diagram, and the glossary, in both color schemes.
2. `[...document.querySelectorAll('*')].filter(el => el.scrollWidth > document.documentElement.clientWidth + 4).length` must be 0.
3. The assembly diagram must fit at contain zoom on first paint: use single-line node labels and `flowchart.wrappingWidth: 440+`. If the zoom label reads "width-priority", shorten labels until it reads "contain".
4. Check for common SVG bugs: paths missing `fill: none` rendering as black blobs, labels clipping at the viewBox edge, and overlapping annotations.
