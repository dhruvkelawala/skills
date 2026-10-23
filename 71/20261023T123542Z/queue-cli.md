# The review queue, read on its own (3a150b0)

New in this PR, so there is no before. `node skills/pr-review/scripts/queue.mjs [--repo owner/name]` prints the queue as JSON for any skill to read: one repository's with `--repo`, as `/pr-review queue` uses it, and every repository's without.

## The queue tests, with gh faked on PATH

```console
$ node --test --test-reporter=spec skills/pr-review/scripts/queue.test.mjs
✔ orders return visits, then stack bottoms, then what unblocks the most, then the smallest (663.149875ms)
✔ leaves out drafts, the user's own PRs, archived repositories, and a PR reviewed at its head that nobody re-requested (524.658334ms)
✔ with --repo, lists only that repository's queue (877.507584ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

## The script on the eval's world: PR #7, and a smaller, lower-numbered layer #5 stacked on it

```console
$ node skills/pr-review/scripts/queue.mjs --repo acme/demo
[
  {
    "repo": "acme/demo",
    "number": 7,
    "url": "https://github.com/acme/demo/pull/7",
    "title": "Retry failed GET requests",
    "author": "teammate",
    "base": "main",
    "head": "39b4670879c5d2c579db57f7e3b4473e73fd90f4",
    "size": 41,
    "files": 5,
    "returnVisit": false,
    "stackBottom": true,
    "unblocks": 1
  },
  {
    "repo": "acme/demo",
    "number": 5,
    "url": "https://github.com/acme/demo/pull/5",
    "title": "Log each retry",
    "author": "teammate",
    "base": "retry-get",
    "head": "0f4430542102acf9ba1d1e6bd1ed8f955d6b8c31",
    "size": 10,
    "files": 3,
    "returnVisit": false,
    "stackBottom": false,
    "unblocks": 0
  }
]
```

## Live, read-only, against GitHub

```console
$ node skills/pr-review/scripts/queue.mjs --repo dhruvkelawala/skills | jq length
0
$ node skills/pr-review/scripts/queue.mjs | jq "length, (.[] | {returnVisit, stackBottom, unblocks})"
2
{"returnVisit":true,"stackBottom":true,"unblocks":0}
{"returnVisit":true,"stackBottom":true,"unblocks":0}
$ node skills/pr-review/scripts/queue.mjs --bogus
usage: queue.mjs [--repo owner/name]
# exit 2
```

The skills repo has no teammate PRs, so its own queue is empty. Repository names, titles and authors are left out of the all-repos run: they belong to private work repositories.
