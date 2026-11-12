# Refresh: revise only what changed

The refresh path keeps an existing set true to code that has moved a little. It revises the documents a change touches and nothing else. A set never gets rewritten wholesale on a schedule; if the diff below turns out structural, stop and take the rebuild path ([rebuild.md](rebuild.md)) instead, with the user's go.

## Steps

1. **Find the base.** The base is the oldest commit any document's footer cites, so a document a past refresh left unchecked is diffed from its own commit. If the footers disagree, say so in the report. A registry or `goal.md` may name an older base (for example a pin on a side branch); use it only when it is older than every footer, never to skip a footer.
2. **Find the target.** Fetch the source repo (fetch only; never pull, check out, reset or build in the user's checkout). The target is the remote default branch, such as `origin/main`, not local `main`, which may lag or have diverged.
3. **List the changes.** `git log --first-parent base..target`, limited to the paths the set covers when it describes part of a repo. If the base is not an ancestor of the target (a pin on a side branch), also compare the trees directly with `git diff base target`, so work that never reached the default branch shows up as a change to check.
4. **Keep the user-facing ones.** UI, routes, commands, visible copy, settings, defaults and thresholds, and behaviour tests. Set aside CI, dependency bumps, refactors that keep behaviour, internal docs and tooling. When in doubt, read the diff.
5. **Re-check the path.** If most of the source files the documents cite are gone, or about 50 or more user-facing PRs landed, this is a rebuild, not a refresh. Stop and report.
6. **Map changes to documents.** For each user-facing change, find the documents that own the behaviour: through the paths in their technical notes, the README's Reference section, and the glossary. A change no document covers is a new document (see "Resuming and extending" in SKILL.md).
7. **Revise those documents.** Read the changed code and tests, rewrite the affected sections, and update goal.md's established facts and the glossary where they moved. Footers on revised documents cite the target commit.
8. **Move the untouched footers honestly.** A document whose cited source paths no change touched can have its footer moved to the target commit; say so in the commit message. A document you could not check keeps its old footer, and the README's scope section names the mix.
9. **Re-verify.** Bring up the product at the target commit ([running-the-product.md](running-the-product.md)) and run the checklist rows for the revised claims. Add rows for new claims, continuing each prefix after its highest number. Update Results in place.
10. **Triage.** New suspected defects become new `B-NN` entries after the highest; an existing entry the change fixed or altered gets a Status line with the target commit.
11. **Close.** Run `check-links.py`, commit as `docs: revise {path}` (one commit per coherent group), push if the repo has a remote, and record the verified commit wherever the project tracks it: the target when every footer moved to it, otherwise the oldest footer that remains, with the documents still on it named.

## Report

Lead with what needs the user: new or changed triage entries (title, where, severity, observed or read from code) and the question of which to file. Then the documents revised, the new commit, and what could not be checked. When nothing user-facing changed, a scheduled run reports nothing.
