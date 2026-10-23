# The review queue, read on its own (1377ca7)

New in this PR, so there is no before. `node skills/pr-review/scripts/queue.mjs` prints the queue as JSON for any skill to read.

## The queue tests, with gh faked on PATH

```console
$ node --test --test-reporter=spec skills/pr-review/scripts/queue.test.mjs
✔ orders return visits, then stack bottoms, then what unblocks the most, then the smallest (809.865958ms)
✔ leaves out drafts, the user's own PRs, archived repositories, and a PR reviewed at its head that nobody re-requested (555.128042ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

## The script on the eval's world: PR #7, and a smaller, lower-numbered layer #5 stacked on it

```console
$ node skills/pr-review/scripts/queue.mjs
[
  {
    "repo": "acme/demo",
    "number": 7,
    "url": "https://github.com/acme/demo/pull/7",
    "title": "Retry failed GET requests",
    "author": "teammate",
    "base": "main",
    "head": "588f49dac31691ceb075d27ba0a63810a501a493",
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
    "head": "efb889737c1af5c0d3f92b338d981237bae5833f",
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
$ node skills/pr-review/scripts/queue.mjs | jq "length, (.[] | {returnVisit, stackBottom, unblocks})"
2
{"returnVisit":true,"stackBottom":true,"unblocks":0}
{"returnVisit":false,"stackBottom":true,"unblocks":0}
real 5.71
```

Repository names, titles and authors are left out of the live run: they belong to private work repositories.
