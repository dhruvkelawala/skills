# Shark Tank pitch deck spec

Build the deck with the `visual-explainer` skill: invoke it and follow its aesthetic rules, avoiding AI-slop patterns. The deck is one self-contained interactive HTML page that the user views in a browser. The user is the shark, and the pipeline is pitching.

Required structure, in order:

1. Hero. A framing of "N ideas walked in, K survived", with count-up stats (ideas generated, lenses, live searches, kills, survivors).
2. The Gauntlet. A funnel of the run (generated, finalists, red-team kills, survivors), one stage per row with a shrinking bar.
3. The Tank. A tabbed pitch per surviving finalist. Each pitch panel holds:
   - a one-liner and badges (type, energies, standout fact)
   - "The pitch", written in pitch-night voice (opening "Sharks, ...") with every claim sourced
   - an animated 6-bar rubric scorecard and a composite (for example 27/30)
   - a market evidence card with linked sources
   - a moat and founder-fit card
   - the magic-moment pull quote (gold-bordered, full width)
   - a collapsible "The sharks attack" section with the red team's actual kill shots, followed by the founder's rebuttal and accepted constraint
   - "The ask", which is the two-week v1, plus the red-team verdict stamp
4. The Kill Floor. Gravestone cards for every red-team kill, each with the idea, what it was, and the cause of death (specific evidence, not vibes). Add a collapsible cut ledger table for ideas eliminated at scoring (columns: idea, what it was, why cut) and a "bench" callout for reserves.
5. The Deal. A decision matrix table (all rubric scores, winner row highlighted) and "the cheque I'd write": one recommendation with the counter-bet named and the risk profiles contrasted (execution risk versus demand risk).

Style notes that worked: a dark stage aesthetic in deep navy and gold, Bricolage Grotesque and Fragment Mono, a shark-fin SVG on the attack summaries, verdict stamps (champion green, viable amber), reveal-on-scroll, animated score bars, and reduced motion respected. Vary the aesthetic between runs per the visual-explainer rules.

Output to `~/.agent/diagrams/<run-name>-pitch.html`, report the path, and open it only when the user asks. Quoted web content in the deck is plain text, never executable markup.
