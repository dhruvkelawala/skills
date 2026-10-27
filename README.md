# skills

## Available skills

| Skill | Description |
|-------|-------------|
| [apr](skills/apr/SKILL.md) | Autoreview from a pinned base, commit, push, open or update a ready-for-review PR, then watch and repair PR review findings until clean. |
| [bro](skills/bro/SKILL.md) | Restate the last message in plain human language, with no jargon. |
| [cleanup](skills/cleanup/SKILL.md) | Free disk space: a read-only audit of Git worktrees, iOS simulators, build artifacts and package-manager caches, then removal by approved bucket, with a hold list for anything that could lose work. `audit` stops after the proposal and can run as a Saturday scheduled task. (pstack) |
| [codebase-dive](skills/codebase-dive/SKILL.md) | Learn a whole unfamiliar or agent-written codebase at your own pace, file by file, fixing as you go with a living checklist. |
| [council](skills/council/SKILL.md) | Put a plan, decision, design, diagnosis, draft or PR before a council of several models. Each member reviews the same brief alone and read-only, the thread changes its position or rebuts with evidence for up to three rounds, and the report shows the changes, the dissent and the follow-ups. `pr <n>` gates a merge: the PR lands through `ship` only after every member passes the same head. |
| [day](skills/day/SKILL.md) | Owns the day's two anchors. The 10:00 report lists builds to start, issues almost ready, the review queue with its first PR prepped, stale PRs, late comments on merged PRs, runs stopped overnight, and a strain line when disk or memory runs low, with each project's progress page above it when the project keeps a `progress-report` skill, and starts a build only when your reply names it. The goodnight check lists every thread waiting on you or gone quiet with continue or stop for each run, stops only what you confirm, and records it for the morning. |
| [eli25](skills/eli25/SKILL.md) | Explain a PR, stack, plan, spike, system or incident as a short page in the Field Guide look, shown in the thread as a T3 visual page and deployed to Vercel only when you ask. |
| [evidence](skills/evidence/SKILL.md) | Write a repo's EVIDENCE.md: how to launch each surface, drive a feature, capture screenshots, recordings, or transcripts, and publish them so PRs can prove changes work. |
| [explain-diff](skills/explain-diff/SKILL.md) | Explain a diff, commit, branch, or PR in plain words: the problem, the key idea, and one real input traced through the changed code. |
| [hillclimb](skills/hillclimb/SKILL.md) | Raise one score toward a target (speed, a critic or eval score, a pass rate, a size) with one change per attempt, keep or revert, and a log. You judge taste scores at checkpoints. (pstack) |
| [how](skills/how/SKILL.md) | A short answer to how code or a PR works, or where a change belongs, with one real input traced through the code at `path:line`. (pstack) |
| [idea-foundry](skills/idea-foundry/SKILL.md) | Generate or pressure-test ambitious project ideas through research, scoring, red-teaming, and pitching. |
| [issue-to-pr](skills/issue-to-pr/SKILL.md) | Take one GitHub issue or Linear ticket to a PR: test-first build, at most two review passes, a captured proof per criterion, a `pr`-format body, and a time-boxed watch, standalone or stacked. `resume` picks up new reviews and moved predecessors. |
| [modernize](skills/modernize/SKILL.md) | Judge an old PR against what its base has become and say MODERNIZE, REWORK or CLOSE with the evidence. Only a MODERNIZE is rebased, checked with `git range-diff` and the focused checks, and pushed with a lease. `day` offers it for PRs going stale. |
| [perf](skills/perf/SKILL.md) | Make one slow thing faster: measure, name the limiter, make one cheapest-first fix, and measure again. `baseline` only measures; `diagnose` explains a live process or a profile without changing code. (pstack) |
| [pr](skills/pr/SKILL.md) | Write a PR title that says what the change does for the user, in the repo's form, and a body that is fast to review: under 250 words of the problem, the change, before and after evidence, a proof line, and merge danger with a one-way or two-way door and the blast radius, with the rest in a collapsed block. |
| [pr-review](skills/pr-review/SKILL.md) | The review command. Bare, it reviews the current branch's PR; with a PR or a stack, it reviews that. `queue` starts a sitting over the current project's PRs waiting on your review: return visits, stack bottoms, what unblocks the most, then the smallest, with the next PR prepped in the background while you read; `queue --mine` walks your own open PRs the same way. `/code-review` and a second opinion from the other model family find the problems first, and T3 writes the tour in the PR's Guide tab. You get an intro with one real example and a wrap-up with the findings, questions for the author and a suggested verdict. One review in your voice, posted only on your word; `try` runs the PR for you to test by hand. `scripts/queue.mjs` gives the queue to other skills. |
| [pr-watch](skills/pr-watch/SKILL.md) | Poll a PR until CI is green, review threads are resolved, and each configured review agent has covered the current HEAD, repairing real bugs in between and declining nits as follow-ups. Every reply opens with a label naming the model that wrote it for you, and nothing with a secret in it goes out. Outside T3 the gate's `--watch` mode watches. |
| [product-description](skills/product-description/SKILL.md) | Build a prose "product description" repo describing what the user sees and exactly what happens when they act, drafted from code and tests, then verified and triaged into a bug list. |
| [promote](skills/promote/SKILL.md) | Turn repeated or severe agent corrections from PRs, run records, transcripts and memory files into the highest check that can stop them, each proven on a past mistake and listed in a rule table. `--report-only` serves issue-to-pr. (pstack) |
| [recap](skills/recap/SKILL.md) | Write a two-minute brief of the session (goal, shipped, decided, in flight, next) and save it for the next session; `/recap last` reads it back with what moved since. |
| [review-ready](skills/review-ready/SKILL.md) | Completion gate for code changes: checks a design contract (readable entry points, deep modules, real seams, tests through the interface, comment rules) and writes the gate report. |
| [ship](skills/ship/SKILL.md) | Record an independent verdict pinned to each PR's patch, and land only the verified run of a stack, bottom up. Works with one GitHub account. The review queue is `pr-review`'s. (pstack) |
| [test-audit](skills/test-audit/SKILL.md) | Gate each new or changed test on the behaviour it protects and the bug that fails it, reject duplicate, tautological and implementation-coupled tests, and prune a suite with a per-test ledger. `issue-to-pr` runs its gate on every test it writes. |
| [ticket](skills/ticket/SKILL.md) | Turn one idea or ask from the thread into one GitHub or Linear issue, labelled `ready-for-agent` only when its criteria are clear and otherwise naming what's missing, with a one-line reply and the link. A spec that splits into many tickets goes to `to-tickets`. |
| [verification-skill](skills/verification-skill/SKILL.md) | Write a project-local `verify-<app>` skill that launches, health-checks and drives the real app with a feature map (`create`), or check every feature from source and live (`check`). (pstack) |
| [verify](skills/verify/SKILL.md) | Discover and run every verification a project defines and report each as passed, failed, or could-not-run. |
| [why](skills/why/SKILL.md) | Why code or a decision looks the way it does, from git and the PR with a confidence word, or why the agent took an action this session. `--deep` searches every source. (pstack) |

## Parts

A part is a skill that other skills run as one of their steps. They load it from its sibling folder, such as `../unslop/SKILL.md`, so the path works wherever the repo's skills are linked.

| Part | Description |
|-------|-------------|
| [unslop](skills/unslop/SKILL.md) | Cut AI tells from prose. eli25, how, explain-diff and why run it last on what they write, and the agent runs it on its own when it writes docs, PR and issue text, or messages to people, but not on chat replies. |

## Installation

Clone this repo on each machine and run the sync script from the clone. The dry run prints every change and makes none:

```sh
node scripts/sync-skills.mjs --dry-run
node scripts/sync-skills.mjs
```

The script fills each agent's skill folder: `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills` and Pi's `~/.pi/agent/skills`. It follows `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `PI_CODING_AGENT_DIR` when they are set, and skips an agent that is not installed.

- This repo's skills are linked from the clone the script runs in, so `git pull` updates them.
- The outside skills are named in [outside-skills.json](outside-skills.json), one line each, with the source and pinned commit in the shape `npx skills` writes to its lock file. The script unpacks each one into `~/.agents/skills` at its pinned commit, and the other folders link to that copy. It fetches only the listed folders, into a cache at `~/.cache/sync-skills`. Outside skills are listed, never copied into this repo, because none of them ships a licence file except `typesafe-ai`.
- Anything else in a folder is reported as `unlisted` and left alone. `--remove-unlisted` removes it. Hidden folders, such as Codex's `.system`, are never touched.
- The script stops if the list names one of this repo's skills, so `pr` is always this repo's `pr`.

Changes travel only through git. To add an outside skill, or bring back a cut one, add its line to `outside-skills.json`. To move one to a newer commit, change its `ref`. Commit, pull on each machine, and run the script again. A run with nothing new changes nothing. Skills that `npx skills add` puts in these folders are replaced or reported on the next run, so add outside skills through the list.

## Credits

Skills marked (pstack) are adapted for Pi from [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed, at `cursor/plugins@fae2c6e` or later; each skill's attribution line names its exact commit. Each carries the upstream license in its directory. `promote` adapts pstack's `reflect` and `correct`. `pr` adapts HumanLayer's PR template and Dex Horthy's show-me visuals, MIT licensed, with the license in its directory. `test-audit` adapts OpenClaw's `test-audit`, MIT licensed, at `openclaw/openclaw@3195fba`, with the license in its directory. `unslop` adapts Siqi Chen's `humanizer`, MIT licensed, at `blader/humanizer@d8085c7`, with the license in its directory. `modernize` adapts Theo Browne's `modernize` from [tstack](https://github.com/t3dotgg/tstack), MIT licensed, at `t3dotgg/tstack@7de017b`, with the license in its directory; `pr-watch`'s comment label, scope rule and T3 watch notes, and `pr`'s title rule, come from the same repo's `leaving-pr-comments`, `babysit-pr` and `file-pr`.

## License

MIT
