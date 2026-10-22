---
name: ticket
description: Use when the user asks to capture one idea or ask as an issue for later, such as "file this" or "make an issue for that". Files one GitHub or Linear issue from what the thread already knows, labels it ready-for-agent only when its acceptance criteria are clear, and replies with the link. Splitting a spec or plan into several tickets is a different job; for that, point the user to /to-tickets and leave this skill unloaded.
---

# Ticket

Capture one idea, or a team ask, that nobody is working on now as one issue, in one short exchange. Write from what the thread already knows. A gap in the thread becomes a named gap in the issue, not a question to the user.

One idea makes one issue. When the thread holds a spec or plan that splits into several tickets, reply that `/to-tickets` splits it, and file nothing.

## 1. Pick the tracker and the repo

The issue goes where the idea's work is tracked.

- **Linear**, through the `linear` CLI, when the repo's `AGENTS.md` or `CLAUDE.md` says its work lives in Linear, or the thread's work item is a Linear ticket. File it in that team.
- **GitHub** otherwise, in the repo the idea is about: the current checkout's (`gh repo view --json nameWithOwner`, REST: `gh api repos/{owner}/{repo} --jq .full_name`), or the one the thread names, passed as `-R <owner/repo>`.

`gh issue` and `gh repo view` spend GitHub's GraphQL quota. When one fails with `API rate limit exceeded` or `RATE_LIMITED`, run the REST call named beside it. `gh api` fills `{owner}/{repo}` from the current checkout, so for a repo the thread names, write its owner and name in their place.

## 2. Write the issue

Read the repo's latest issues and copy their headings and tone: `gh issue list --state all --limit 5 --json title,body` (REST: `gh api 'repos/{owner}/{repo}/issues?state=all&per_page=5'`). Keep `## Acceptance criteria` and `## In scope` sections even when their issues have none, because step 3 judges both. When there are no issues, use this shape:

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

## 3. Decide the label

The acceptance criteria are **clear** when each one is checkable, so that someone could say pass or fail by running or reading something, and the thread says where the change lands. Then the issue gets the `ready-for-agent` label.

Otherwise leave it unlabelled, and end the body with this section, one bullet per gap that keeps the issue from being ready, such as a criterion nobody can check, an unknown scope or an open product decision:

```md
## What's missing
- <gap>
```

`day` lists unlabelled issues with this section as almost ready, so keep the heading exactly as written.

## 4. File it

Write the body to a temp file, then:

- GitHub: `gh issue create --title <title> --body-file <file>`, adding `--label ready-for-agent` when the criteria are clear (REST: `gh api repos/{owner}/{repo}/issues -f title=<title> -F body=@<file>`, adding `-f 'labels[]=ready-for-agent'`). When the repo has no such label, create it first: `gh label create ready-for-agent --description "Ready to build with /issue-to-pr" --color 0e8a16`.
- Linear: `linear issue create --team <team> --title <title> --description-file <file> --no-interactive`, adding `--label ready-for-agent` when the criteria are clear. When the team has no such label, create it first: `linear label create --name ready-for-agent --team <team>`.

**Complete when:** one issue exists in the tracker that owns the idea, it carries `ready-for-agent` exactly when its criteria are clear, and otherwise its body ends with `## What's missing`.

## 5. Reply

Reply with one line: the issue's number or Linear ID, whether it is ready, and its link. The issue body carries the detail.

```text
Filed <#n or ID>, ready-for-agent: <link>
Filed <#n or ID>, not ready, missing <the main gap>: <link>
```

Then stop. A build starts only on the user's word, through `/issue-to-pr`.

**Complete when:** the reply is that one line, and nothing else has started.
