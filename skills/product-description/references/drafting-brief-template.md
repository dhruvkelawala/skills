# Drafting brief template

Fill in the braces and save the result once, as `BRIEF.md` in the run folder. Each drafter's own prompt is then three lines: "Read and follow {path to BRIEF.md} exactly.", its documents with what each owns, and its ID prefixes, start numbers and fragment file names.

```markdown
# Drafting brief: {product} product description, {build | rebuild} at {short sha}

You are drafting part of a product description: prose documents that describe, from the outside in, what a {user} sees on {the surface}, what they can do, and exactly what happens when they do it.{ For a rebuild: The set is being rebuilt from scratch because the product changed structurally since {old sha}. Do not carry an old claim forward without finding it in the new code.}

## Read first (in this order)

1. `{repo}/README.md`: the template ({N} sections, the phases, the variant rows, the interrupt rows, the cross-cutting concerns, all fixed and in order), the structure and the scope.
2. `{repo}/goal.md`: writing rules, reading order and "Things already established". Do not contradict an established fact; link to the document that owns it. If the source shows an established fact is wrong, say so in your report rather than silently diverging.
3. `{repo}/glossary.md`: use its words exactly.
4. `{repo}/{pilot path}`: the pilot. Match its depth, tone, table shapes (row and column names exactly) and footer.
5. The recon notes in `{run folder}/recon/` relevant to your documents. They are a map, not a source of truth: confirm every claim in the source, and report any note you find wrong.

## Source

Read-only clean clone at {short sha}: `{run folder}/src`. Never edit it, never run git commands that change it, never install, build or run tests in it. Read code and tests ({test folders}).

## The running product

{Either: An owned instance is running at {URL or simulator}. You may drive it with {tool}, scripts in `{run folder}/fragments/scripts/<your docs>/`, screenshots in `{run folder}/shots/<your docs>/`. {Auth, notice, seed and mock instructions.} Never touch production or real user data. Say which evidence each observed claim rests on (observed, mocked, seeded).}
{Or: One driver owns the running product; do not drive, install or screenshot anything. Your claims are code-derived, or "covered by repo test <name>" when a test asserts them (do not claim it passed).}

## What to write

1. Your assigned documents, each on the full template at pilot depth or more (about {150–250} lines). Every table cell filled ("No effect", "No handler" or "Not determined" where true). One small `stateDiagram-v2` per interaction. Visible copy quoted exactly. Technical notes only in `> Technical note:` blocks, with source paths there and nowhere else. Relative links to the owning documents (every planned path is in the README structure). Footer exactly: `Verified against {repo name} commit \`{short sha}\`.` after the `## Open questions and verification` list. Overwrite any old file at your path without reading it for facts.
2. A checklist fragment per document at `{run folder}/fragments/checklist-<area>-<name>.md`: a `## <area>/<name>.md` heading, one table `| ID | P | Device | Claim | Setup | Steps | Expected | Result |`, one row per observable claim (typically 20–40), IDs `<PREFIX>-NN` from the number you are given, P1 for an established fact, a load-bearing claim or a suspected defect, P2 for an ordinary claim, P3 for a number, colour or timing. The Claim cell ends with a link written from `verification/`, such as `([Finish](../{area}/{name}.md#finish))`. Result is `—` unless you observed it yourself. Then a `### Not checkable by hand` list.
3. A defects fragment at `{run folder}/fragments/defects-<area>-<name>.md`: every suspected defect or product call, each with a title, where the user meets it, what happens against what was expected, reproduction steps, the cause with `path:line`, a severity (high, medium, low), the decision needed (fix or product call) and the evidence. Then `## Glossary additions` for any term you needed that the glossary lacks.

## Rules

- Write only your documents and your fragment files. Do not edit the README, goal.md, the glossary or other documents, and do not commit.
- Never modify the source. No issue filing.
- When code and tests do not settle a behaviour, write what they do settle and put the rest in "Open questions and verification". Do not guess.
- Report back in under 15 lines: files written, what you observed, the most important open questions and suspected defects, and any recon claim or established fact you found wrong.
```
