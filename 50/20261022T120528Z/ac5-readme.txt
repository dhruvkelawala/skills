# AC5: the README's install section explains the script and the list, and drops the Pi settings.json route (head 0e30b51, tree 3ea06d6)

$ sed -n '/^## Installation/,/^## Credits/p' README.md
## Installation

Clone this repo on each machine and run the sync script from the clone. The dry run prints every change and makes none:

```sh
node scripts/sync-skills.mjs --dry-run
node scripts/sync-skills.mjs
```

The script fills each agent's skill folder: `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills` and Pi's `~/.pi/agent/skills`. It follows `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `PI_CODING_AGENT_DIR` when they are set, and skips an agent that is not installed.

- This repo's skills are linked from the clone the script runs in, so `git pull` updates them.
- The outside skills are named in [outside-skills.json](outside-skills.json), one line each, with the source and pinned commit in the shape `npx skills` writes to its lock file. The script unpacks each one into `~/.agents/skills` at its pinned commit, and the other folders link to that copy. It fetches only the listed folders, into a cache at `~/.cache/sync-skills`. Outside skills are listed, never copied into this repo, because none of them ships a licence file.
- Anything else in a folder is reported as `unlisted` and left alone. `--remove-unlisted` removes it. Hidden folders, such as Codex's `.system`, are never touched.
- The script stops if the list names one of this repo's skills, so `pr` is always this repo's `pr`.

Changes travel only through git. To add an outside skill, or bring back a cut one, add its line to `outside-skills.json`. To move one to a newer commit, change its `ref`. Commit, pull on each machine, and run the script again. A run with nothing new changes nothing. Skills that `npx skills add` puts in these folders are replaced or reported on the next run, so add outside skills through the list.


$ grep -c -E "settings\.json|\"packages\"" README.md
0
