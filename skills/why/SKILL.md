---
name: why
description: Use for /why, a question about why code or a past decision has its current shape, or a challenge to an action you took in this session ("why did you delete X?"). Answers from git and the PR in one to three sentences with a confidence word; `--deep` searches every source. Failures go to diagnosing-bugs, slowness to perf.
---

# Why

Pick the mode from what the question is about:

- **Your own action.** The question names something you did in this session: an edit, a deletion, a command, a choice, or stopping. Use "Why did you do that".
- **Code history.** The question asks why code, a setting, or a past decision looks the way it does. Use "Code history". Run the deep sweep only when the user asks for it with `--deep`, "dig deeper", or by naming more sources.

A bare `/why` asks about your last action if you just acted, and otherwise about the code discussed last. Say which in your first line.

## Why did you do that

1. Find the action in this session: the tool call, the edit, or the message where you decided. Quote it in one line.
2. Give the reason you had at the time, in one to three sentences. Use the reason the session shows, even when a better one comes to mind now.
3. Judge it. If it was a mistake, start the answer with "That was a mistake." and say what the right action was. Stopping to ask for a confirmation the user already gave counts as a mistake. If it was right, say what would have broken without it.
4. Leave the files as they are. Offer the fix or the next step in one line, and do it when the user says so.

**Done when** the answer names the action, the real reason, and whether it was a mistake, and no file changed while answering.

## Code history

1. Find the lines in question and the commit that introduced them. `git log -S '<literal>'` or `-G '<regex>'` finds the introduction; `git blame -L <start>,<end> -- <file>` and `git log --follow -- <file>` show later edits. The reason is usually in the commit that introduced the lines, not the latest edit.
2. Read that commit's message and its PR. Find the PR from the `(#123)` in the subject or from `gh api repos/<owner>/<repo>/commits/<sha>/pulls`. Read it with `gh pr view <n> --json title,body,comments,reviews,closingIssuesReferences`, the inline threads with `gh api repos/<owner>/<repo>/pulls/<n>/comments`, and the linked issue if there is one.
3. Answer in this shape:

```md
<the answer, one to three sentences>

Evidence: <commit SHA, PR link, issue link, or path:line, with a short quote of the deciding sentence>
Confidence: <Direct | Supported | Inferred | Speculative | Unknown>
```

Choose the confidence word from the evidence:

- **Direct.** An author wrote the reason down in a commit, PR, issue, or doc. Quote it.
- **Supported.** Several separate clues agree, but nobody wrote the reason down. A PR that repeats a doc counts as one clue.
- **Inferred.** A reasonable reading of the code and history. Name the clues.
- **Speculative.** More than one story fits thin evidence. Give the best one and call it a guess.
- **Unknown.** The search did not answer the question. Say where you looked.

Write "because" only at Direct or Supported. Code shows what happens; author text shows why someone chose it. If the question comes before a change, add one line on what to keep and what the change could break.

**Done when** the answer has at most three sentences, at least one evidence link, and a confidence word that matches that evidence.

## Deep sweep

Read [references/sources.md](references/sources.md), then search each source this session can reach: git and PRs, the issue tracker, docs, team chat, observability, error tracking, and analytics. Hand each source to a helper agent with the `research` role: on Pi or SumoCode spawn role `research`; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. With no helper available, search the sources yourself one after another and say so.

Answer in the same shape, with one confidence word per claim, then one coverage line per source.

**Done when** all seven sources have a coverage line and every claim has its own confidence word.

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@e5a8186. Upstream license: [LICENSE](LICENSE).
