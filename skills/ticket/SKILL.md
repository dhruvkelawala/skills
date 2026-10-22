---
name: ticket
description: Use when the user asks to capture one idea or ask as an issue for later, such as "file this" or "make an issue for that". Files one GitHub or Linear issue from what the thread already knows, labels it ready-for-agent only when its acceptance criteria are clear, and replies with the link. A spec or plan that splits into several tickets goes to to-tickets instead.
---

# Ticket

Capture one idea, or a team ask, that nobody is working on now as one issue, in one short exchange. Write from what the thread already knows. A gap in the thread becomes a named gap in the issue, not a question to the user.

One idea makes one issue. When the thread holds a spec or plan that splits into several tickets, reply that `/to-tickets` splits it, and file nothing.

## 1. Pick the tracker and the repo

The issue goes where the idea's work is tracked.

- **Linear**, through the `linear` CLI, when the repo's `AGENTS.md` or `CLAUDE.md` says its work lives in Linear, or the thread's work item is a Linear ticket. File it in that team.
- **GitHub** otherwise, in the repo the idea is about: the current checkout's (`gh repo view --json nameWithOwner`, REST: `gh api repos/{owner}/{repo} --jq .full_name`), or the one the thread names, passed as `-R <owner/repo>`.

## 2. Write the issue

Read the repo's latest issues and copy their headings and tone: `gh issue list --state all --limit 5 --json title,body` (REST: `gh api 'repos/{owner}/{repo}/issues?state=all&per_page=5'`). When there are none, use this shape:

```md
## What's wrong
<the problem today, when the idea fixes one>

## What to build
<the change, as the user will see it>

## Acceptance criteria
- <one checkable outcome per line>

## In scope
<the paths or areas the change touches>
```

Fill each section only from what the thread said, decided or showed. The title names the change in plain words.

## 3. File it

Write the body to a temp file, then:

- GitHub: `gh issue create --title <title> --body-file <file>` (REST: `gh api repos/{owner}/{repo}/issues -f title=<title> -F body=@<file>`).
- Linear: `linear issue create --team <team> --title <title> --description-file <file> --no-interactive`.

**Complete when:** one issue exists in the tracker that owns the idea, with a body built only from the thread.
