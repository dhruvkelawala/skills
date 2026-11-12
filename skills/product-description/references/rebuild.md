# Rebuild: a new set for a product that outgrew the old one

The rebuild path replaces every document when the code has changed structurally (see "Choose the path" in SKILL.md). It reuses the build phases, with four additions: the old set is archived and tagged, a recon pass maps the new code before any writing, the old triage list is re-assessed rather than dropped, and one driver verifies the result. Start only on the user's go; a scheduled run reports a rebuild and waits.

A rebuild of a mid-sized product runs several hours. Post a one-line progress update whenever a phase ends or a finding changes the plan.

## 1. Archive and tag the old set

- Tag the old set's last commit, for example `first-build-<old sha>`, and push the tag with the rebuild, so every old link still resolves somewhere.
- Move the old `verification/` checklists, and any material that is not a feature document (proposals, roadmaps, evidence), into `archive/<old sha>/`, unchanged, with a short `archive/<old sha>/README.md`: what it holds, and that its links resolve at the tag.
- Delete the old feature documents from the tree. They are at the tag; keeping them beside the new ones invites copying stale claims.
- Keep the old IDs alive: new checklist rows continue each old prefix after its highest number, new prefixes start at 01, and triage keeps `B-01`… with new entries after the highest.

## 2. Bring up the product

Make a clean clone of the target commit in a run folder outside the user's checkout (for example `~/.agent/verify/<product>/product-description-<sha>/src`), install there, and launch the product with the repo's own recipe ([running-the-product.md](running-the-product.md)). Keep it running for the whole rebuild. Run the repo's own maintained end-to-end tests once, one at a time, and record what passed and why anything could not run.

## 3. Recon pass

Before writing anything, map the new code with three to five read-only agents in parallel, one per area of state: typically the data model, storage and lifecycle; the main interaction; the secondary surfaces; and output. Each reads the state owners, the UI, the server or native code, the tests, and the defaults, and writes `recon/<area>.md` in the run folder: one section per question, a bullet fact per line with a `path:line` citation, then "Suspected defects or surprises" and "Could not determine". Recon notes are a map, not a source of truth: every drafter confirms a claim in the source before writing it.

## 4. Steering files

Write the new README (structure, coverage table, scope decisions with a History line naming the old commit and the tag), the glossary and `goal.md` from the recon notes, before any document. Fill goal.md's "Things already established" now, from the recon: the numbers, rules and copy every document will touch, each naming the document that owns it. Keep the old template's shape (phases, variant axes, interrupt rows, cross-cutting order) when the product kind has not changed, so the old and new sets stay comparable. Commit the scaffold.

## 5. Pilot

Write the pilot yourself, from the source, and observe it on the running product. Write its checklist fragment too; drafters copy the pilot's tables exactly.

## 6. Parallel drafting

Fan out one drafter per one to three documents. Each gets the brief in [drafting-brief-template.md](drafting-brief-template.md), filled in: its documents, their checklist ID prefixes and start numbers, its fragment file names and the recon notes to read. Drafters write their documents plus two fragments each (checklist rows and suspected defects with glossary proposals) and never edit shared files: the README, goal.md, the glossary and each other's documents stay with you.

At the same time, give one read-only agent the old triage list: for each old entry, decide fixed, still present, changed or obsolete at the target commit, with the evidence.

## 7. Review as results land

Drafters will find established facts that are wrong. When one does, confirm it in the source, then correct goal.md, the glossary and every document that repeats it at once: search the set for the old wording. Merge glossary proposals, removing duplicates. Keep a short list of what you corrected for the report.

## 8. Consistency pass

- A structural check over every feature document: all eight sections, the footer citing the target commit, every variant and interrupt row in order, every cross-cutting paragraph in order, at least one state diagram, no reference to the old commit.
- A search for every fact you corrected in step 7.
- `check-links.py` over the tree without the archive (the archive's links resolve at the tag).
- Every Mermaid block parsed with the real Mermaid parser.
- Source paths only inside technical notes.

## 9. Verify with one driver

Assemble the checklists from the fragments. Then give one agent sole control of the running product: it runs every P1 row the product can show, then P2 rows as time allows, records each Result in place, saves a screenshot for every fail, and reports rows where the document or the row itself was wrong. Correct those rows and documents yourself, noting "row corrected after the pass" in the Result. A suspected defect that does not reproduce is kept in triage as "not reproduced", not filed.

## 10. Triage merge

Give one agent every defects fragment, the re-assessment and the checklists. One entry per root cause, with every document that raised it under "Raised by"; old entries keep their numbers with a status line; resolved old entries move to a short "Resolved since <old sha>" section; entries the pass reproduced say so with their row IDs. Check its links.

## 11. Close

Run the launch recipe's cleanup (keep the evidence outside the repo), commit in groups (steering files, documents, checklists, triage), push the branch and the tag, and record the new verified commit wherever the project tracks it. Report problem areas first: the triage counts, the entries that need a decision, what could not be checked, and the question of which entries to file.
