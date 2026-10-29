# Independent executable captures

Verifier Claude Opus 5.5, high, tested `9e3bd8337bc17f42131e183987ce4fe4124438a6`, tree `15e7c4f47a2149f7be358fd98f4cb1b13f758488`. These are synthetic fixtures and adapter replay through actual CLI/API ingestion and readback. They do not prove automatic T3 capture.

## blast-result.json

```json
{
  "testedHead": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "scratch": "<verifier>/blast-iFkKjz",
  "disabled": {
    "unset": {
      "hook": {
        "exit": 0,
        "status": "disabled"
      },
      "event": {
        "exit": 0,
        "status": "disabled"
      },
      "status": {
        "exit": 0,
        "status": "disabled"
      },
      "external": {
        "exit": 0,
        "status": "disabled"
      },
      "observe": {
        "exit": 0,
        "status": "disabled"
      }
    },
    "enabledFalse": {
      "hook": {
        "exit": 0,
        "status": "disabled"
      },
      "event": {
        "exit": 0,
        "status": "disabled"
      },
      "status": {
        "exit": 0,
        "status": "disabled"
      },
      "external": {
        "exit": 0,
        "status": "disabled"
      },
      "observe": {
        "exit": 0,
        "status": "disabled"
      }
    }
  },
  "disabledOutboxCreated": false,
  "originating": {
    "unset": {
      "taskExit": 7,
      "ms": 30,
      "lines": [
        "before",
        "{\"status\":\"disabled\"}",
        "after hook=0"
      ]
    },
    "looseMode0644": {
      "taskExit": 7,
      "ms": 29,
      "lines": [
        "before",
        "{\"status\":\"unavailable\"}",
        "after hook=0"
      ]
    },
    "malformed": {
      "taskExit": 7,
      "ms": 28,
      "lines": [
        "before",
        "{\"status\":\"unavailable\"}",
        "after hook=0"
      ]
    },
    "deadPort": {
      "taskExit": 7,
      "ms": 77,
      "lines": [
        "before",
        "{\"status\":\"captured\",\"accepted\":1,\"delivery\":{\"status\":\"flushed\",\"delivered\":0,\"pending\":1,\"exhausted\":0,\"remembered\":0,\"rejected\":0},\"coverage\":\"partial\"}",
        "after hook=0"
      ]
    },
    "remoteHttp": {
      "taskExit": 7,
      "ms": 48,
      "lines": [
        "before",
        "{\"status\":\"captured\",\"accepted\":1,\"delivery\":{\"status\":\"unavailable\"},\"coverage\":\"partial\"}",
        "after hook=0"
      ]
    }
  },
  "deadPortStatusAfterHook": {
    "status": "available",
    "pending": 1,
    "exhausted": 0,
    "remembered": 0,
    "rejected": 0
  },
  "remotePlainHttpFlush": {
    "status": "unavailable"
  },
  "busyLock": {
    "exit": 0,
    "ms": 30,
    "status": "busy"
  },
  "enabled": {
    "hook": "captured",
    "event": "accepted",
    "external": "accepted",
    "observe": "accepted",
    "posts": 5,
    "paths": [
      "/api/public/otel/v1/traces",
      "/api/public/scores"
    ]
  },
  "serialized": {
    "attributeKeys": [
      "langfuse.observation.metadata.allocation",
      "langfuse.observation.metadata.attempt",
      "langfuse.observation.metadata.childCoverage",
      "langfuse.observation.metadata.eventId",
      "langfuse.observation.metadata.evidence",
      "langfuse.observation.metadata.execution",
      "langfuse.observation.metadata.head",
      "langfuse.observation.metadata.invocation",
      "langfuse.observation.metadata.kind",
      "langfuse.observation.metadata.model",
      "langfuse.observation.metadata.outcome",
      "langfuse.observation.metadata.reason",
      "langfuse.observation.metadata.repository",
      "langfuse.observation.metadata.request",
      "langfuse.observation.metadata.revision",
      "langfuse.observation.metadata.schema",
      "langfuse.observation.metadata.session",
      "langfuse.observation.metadata.skill",
      "langfuse.observation.metadata.stage",
      "langfuse.observation.metadata.time",
      "langfuse.observation.metadata.usage",
      "langfuse.observation.metadata.workflow",
      "langfuse.observation.model.name",
      "langfuse.observation.type",
      "langfuse.observation.usage_details",
      "langfuse.trace.name",
      "langfuse.trace.tags",
      "service.name",
      "session.id"
    ],
    "unexpectedAttributeKeys": [],
    "scoreKeys": [
      "comment",
      "dataType",
      "id",
      "name",
      "observationId",
      "traceId",
      "value"
    ],
    "canaryInExports": false,
    "secretInExports": false,
    "inputOutputAttributes": []
  },
  "serializedOutbox": {
    "files": 1,
    "lockLeft": false,
    "canary": false,
    "secret": false,
    "modes": [
      "600"
    ],
    "dirMode": "700"
  },
  "observeOverrides": {
    "workflow": "blast-owner-wf",
    "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
    "attempt": "owner-a1",
    "stage": "build",
    "reason": "autonomous",
    "repairsField": "absent",
    "mergeField": "absent"
  },
  "record": {
    "bytesUnchanged": true,
    "mtimeUnchanged": true
  },
  "policyFiles": {
    "existingAtBase": 45,
    "changedOrAdded": [
      "M\tskills/issue-to-pr/SKILL.md",
      "A\tskills/issue-to-pr/references/observability.md",
      "A\tskills/issue-to-pr/scripts/observe.mjs",
      "A\tskills/issue-to-pr/scripts/observe.test.mjs"
    ]
  },
  "referencesToInstrumentation": [
    "skills/issue-to-pr/references/observability.md",
    "skills/issue-to-pr/scripts/observe.mjs",
    "skills/issue-to-pr/scripts/observe.test.mjs"
  ],
  "skillMdNumstat": "4\t0\tskills/issue-to-pr/SKILL.md",
  "generatedHooks": {
    "create": [
      0,
      0
    ],
    "createAgainRefused": true,
    "secretInHookFiles": false,
    "codexEndTimeout": 3,
    "trusted": "unassessed",
    "removeModifiedRefused": true,
    "removeUnchanged": true
  },
  "worktreeGeneratedHooks": []
}
```

## live/50-hook-read.json

```json
{
  "testedHead": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "testedTree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "phase": "cli-hook-adapter-replay readback",
  "workflow": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922",
  "traceId": "486b837ae52cc829b69e593018c82a50",
  "expected": {
    "total": 480,
    "scored": 5,
    "requests": 6,
    "failed": 1,
    "unknownUsage": 1,
    "observations": 10
  },
  "metrics": {
    "sum_value": 480,
    "count_count": 5
  },
  "metricsReadAttempts": [
    {
      "at": "2026-10-29T21:44:27.149Z",
      "ok": true
    }
  ],
  "observationReadAttempts": [
    {
      "at": "2026-10-29T21:44:27.166Z",
      "ok": true
    }
  ],
  "rawRows": 11,
  "duplicateIdRows": 1,
  "uniqueObservations": 10,
  "totalsFromLatestVersions": 480,
  "totalsRoot": {
    "requests": 6,
    "failedRequests": 1,
    "unknownUsage": 1,
    "ambiguousRequests": 6,
    "inclusive": {
      "input": 266,
      "output": 44,
      "cacheRead": 240,
      "cacheWrite": 20,
      "cacheWrite5m": 20,
      "cacheWrite1h": 0,
      "reasoning": 12,
      "total": 480
    },
    "exclusive": null,
    "childCoverage": "partial",
    "cost": null
  },
  "totalsChildOnly": {
    "requests": 2,
    "failedRequests": 0,
    "unknownUsage": 0,
    "ambiguousRequests": 2,
    "inclusive": {
      "input": 250,
      "output": 30,
      "cacheRead": 90,
      "cacheWrite": null,
      "cacheWrite5m": null,
      "cacheWrite1h": null,
      "reasoning": 12,
      "total": 280
    },
    "exclusive": null,
    "childCoverage": "partial",
    "cost": null
  },
  "usageDetails": {
    "A": {
      "input": 10,
      "output": 7,
      "cache_read": 100,
      "cache_write_5m": 20,
      "cache_write_1h": 0,
      "total": 137
    },
    "B": {
      "input": 5,
      "output": 6,
      "cache_read": 50,
      "total": 61
    },
    "C": {
      "input": 1,
      "output": 1,
      "cache_read": 0,
      "total": 2
    },
    "codex": [
      {
        "input": 100,
        "output": 12,
        "cache_read": 50,
        "reasoning": 8,
        "total": 170
      },
      {
        "input": 60,
        "output": 6,
        "cache_read": 40,
        "reasoning": 4,
        "total": 110
      }
    ]
  },
  "attempts": {
    "A": "first",
    "B": "first",
    "C": "second"
  },
  "failedRequestLevel": "ERROR",
  "childIdentity": [
    {
      "provider": "openai",
      "model": "gpt-6.1-sol",
      "effort": "xhigh",
      "turn": "turn-1",
      "task": "verifier-delegated-task",
      "parent": "root",
      "session": "present"
    },
    {
      "provider": "openai",
      "model": "gpt-6.1-sol",
      "effort": "xhigh",
      "turn": "turn-1",
      "task": "verifier-delegated-task",
      "parent": "root",
      "session": "present"
    }
  ],
  "rootUnknownProvider": "absent(unknown)",
  "distinctLifecycleKinds": [
    "request",
    "skill.finished",
    "skill.loaded",
    "skill.started"
  ],
  "skillStartedParents": [
    {
      "invocation": "child",
      "parent": "root",
      "revision": "32ddfa6a191affb6dfc6b6ca7af917c804ecf54210749a10d4e7f8501c2f14c6"
    },
    {
      "invocation": "root",
      "parent": null,
      "revision": "52a01708ab369ed67a0e8b30124613082a08ec8ceafd9b9b4899cdf943ba07a4"
    }
  ],
  "schema": [
    "skill-run/v1"
  ],
  "eventIdsUnique": true,
  "storedMetadataKeys": [
    "allocation",
    "attempt",
    "attributes.langfuse.observation.level",
    "attributes.langfuse.observation.model.name",
    "attributes.langfuse.observation.type",
    "attributes.langfuse.observation.usage_details",
    "attributes.langfuse.trace.name",
    "attributes.langfuse.trace.tags",
    "attributes.session.id",
    "childCoverage",
    "effort",
    "eventId",
    "evidence",
    "execution",
    "head",
    "invocation",
    "kind",
    "model",
    "outcome",
    "parent",
    "provider",
    "repository",
    "request",
    "resourceAttributes.service.name",
    "revision",
    "schema",
    "scope.name",
    "session",
    "skill",
    "task",
    "time",
    "turn",
    "usage",
    "workflow"
  ],
  "nonAllowlistedMetadataKeys": [],
  "observationsWithInputOrOutput": 0,
  "storedCanaryPresent": false,
  "runtimeTokenScores": 5,
  "costFields": [
    "{}",
    "{\"input\":0.000002,\"output\":0.00001,\"total\":0.000012}",
    "{\"input\":0.00001,\"output\":0.00006,\"total\":0.00007}"
  ]
}
```

## live/50-lifecycle-read.json

```json
{
  "testedHead": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "testedTree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "phase": "lifecycle readback",
  "workflow": "verifier-lifecycle-cd2c0f56-3a40-4562-a784-038b776a935f",
  "uniqueObservations": 14,
  "readAttempts": [
    {
      "at": "2026-10-29T21:43:49.085Z",
      "ok": true
    }
  ],
  "storedWorkflows": [
    "verifier-lifecycle-cd2c0f56-3a40-4562-a784-038b776a935f"
  ],
  "storedHeads": [
    "9e3bd8337bc17f42131e183987ce4fe4124438a6"
  ],
  "storedRepository": [
    "verifier/synthetic"
  ],
  "storedStages": [
    "done",
    "verify",
    "watching",
    "build"
  ],
  "attempts": [
    "attempt-2",
    "attempt-1"
  ],
  "revisions": [
    "52a01708ab369ed67a0e8b30124613082a08ec8ceafd9b9b4899cdf943ba07a4"
  ],
  "providerModelEffort": [
    "codex/gpt-6.1-sol/xhigh"
  ],
  "gates": [
    {
      "reason": "expected-red",
      "outcome": "failed",
      "level": "DEFAULT",
      "time": "2026-10-29T21:40:31.958Z"
    },
    {
      "reason": "recovered",
      "outcome": "failed",
      "level": "DEFAULT",
      "time": "2026-10-29T21:40:33.958Z"
    },
    {
      "reason": "unrecovered",
      "outcome": "failed",
      "level": "ERROR",
      "time": "2026-10-29T21:41:46.958Z"
    },
    {
      "reason": null,
      "outcome": "unknown",
      "level": "DEFAULT",
      "time": "2026-10-29T21:41:47.958Z"
    },
    {
      "reason": null,
      "outcome": "unknown",
      "level": "DEFAULT",
      "time": "2026-10-29T21:41:48.958Z"
    },
    {
      "reason": null,
      "outcome": "verified",
      "level": "DEFAULT",
      "time": "2026-10-29T21:41:49.958Z"
    }
  ],
  "errorObservations": [
    {
      "name": "gate",
      "reason": "unrecovered"
    }
  ],
  "evidenceFailureScores": [
    {
      "value": false,
      "comment": null
    },
    {
      "value": true,
      "comment": null
    }
  ],
  "repairs": [
    "user-requested",
    "autonomous"
  ],
  "summary": {
    "activeMs": 30000,
    "waitMs": 60000,
    "execution": "completed",
    "outcome": "verified",
    "repairs": {
      "autonomous": 1,
      "requested": 1
    }
  },
  "wrongHeadOutcome": "unknown",
  "expiredOutcome": "unknown",
  "storedCanaryPresent": false
}
```

## live/50-research-read.json

```json
{
  "testedHead": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "testedTree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "phase": "installed research readback",
  "workflow": "verifier-research-9b07c56f-47d3-4da6-bf96-610ad43b9c41",
  "readAttempts": [
    {
      "at": "2026-10-29T21:43:49.189Z",
      "ok": true
    }
  ],
  "kinds": [
    "skill.finished",
    "skill.loaded",
    "skill.started"
  ],
  "storedRevision": [
    "32ddfa6a191affb6dfc6b6ca7af917c804ecf54210749a10d4e7f8501c2f14c6"
  ],
  "independentRevision": "32ddfa6a191affb6dfc6b6ca7af917c804ecf54210749a10d4e7f8501c2f14c6",
  "revisionFiles": [
    "agents/openai.yaml",
    "SKILL.md"
  ],
  "artifact": {
    "uri": "https://github.com/dhruvkelawala/skills/blob/9e3bd8337bc17f42131e183987ce4fe4124438a6/research/langfuse-pilot-capture-boundary.md",
    "sha256": "991b5ad5be7e41c9fdacd90be3b6b5c2091b9656db2304951148a7079a926b2d",
    "head": null,
    "result": "unknown",
    "expires": null
  },
  "independentArtifactSha": "991b5ad5be7e41c9fdacd90be3b6b5c2091b9656db2304951148a7079a926b2d",
  "artifactUriMatches": true,
  "evidence": [
    {
      "uri": "https://learn.chatgpt.com/docs/hooks",
      "sha256": "d83234bb8c5c85be8eccc258bf5a9e95c713ba953b41740d0a184f2cece3f880",
      "head": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
      "result": "unknown",
      "expires": "2026-11-05T21:42:03.033Z"
    }
  ],
  "outcomeRequestedVerifiedStored": "unknown",
  "execution": "completed",
  "task": "verifier-synthetic-task",
  "issueToPrFieldsAbsent": true,
  "storedCanaryPresent": false
}
```

## live/09-outage-fresh-status-probe.json

```json
{
  "status": "available",
  "pending": 3,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```

## live/11-outage-recover-probe.json

```json
{
  "status": "flushed",
  "delivered": 3,
  "pending": 0,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```

## live/11-outage-recover-cli.json

```json
{
  "phase": "fresh-process-cli-flush",
  "exit": 0,
  "result": {
    "status": "flushed",
    "delivered": 1,
    "pending": 0,
    "exhausted": 0,
    "remembered": 0,
    "rejected": 0
  }
}
```

## live/20-reject-http.json

```json
{
  "wrongKeyOtlpHTTP": 401
}
```

## live/20-reject-recover.json

```json
{
  "testedHead": "9e3bd8337bc17f42131e183987ce4fe4124438a6",
  "testedTree": "15e7c4f47a2149f7be358fd98f4cb1b13f758488",
  "phase": "fresh-process-authenticated-recovery",
  "status": "flushed",
  "delivered": 1,
  "pending": 0,
  "exhausted": 0,
  "remembered": 0,
  "rejected": 0
}
```

## live/19-alerts-final.json

```json
[
  {
    "workflow": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353",
    "rule": {
      "projectId": "bakeoff-project",
      "window": "1h",
      "thresholdOperator": "GT",
      "warningThreshold": null,
      "triggerIds": [
        "1cd97784-3de4-4589-ae55-fb88615bb380"
      ],
      "tags": [
        "skill-run/v1"
      ],
      "name": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353: token warning; evidence trace f3b468fc5fbea7596f282d5f121c2492",
      "view": "scores-numeric",
      "metric": {
        "measure": "value",
        "aggregation": "sum"
      },
      "filters": [
        {
          "column": "traceId",
          "operator": "=",
          "value": "f3b468fc5fbea7596f282d5f121c2492",
          "type": "string"
        },
        {
          "column": "name",
          "operator": "=",
          "value": "runtime-tokens",
          "type": "string"
        }
      ],
      "alertThreshold": 100
    },
    "receipts": [
      {
        "monitorId": "cmvu2jauh0005p826xukdqaxf",
        "monitorName": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353: token warning; evidence trace f3b468fc5fbea7596f282d5f121c2492",
        "severity": "ALERT",
        "metricValue": 240,
        "alertThreshold": 100,
        "thresholdOperator": "GT",
        "filters": [
          {
            "column": "name",
            "operator": "=",
            "value": "runtime-tokens",
            "type": "string"
          },
          {
            "column": "traceId",
            "operator": "=",
            "value": "f3b468fc5fbea7596f282d5f121c2492",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793306498749-1793310098749&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3Bf3b468fc5fbea7596f282d5f121c2492%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353",
    "rule": {
      "projectId": "bakeoff-project",
      "window": "1h",
      "thresholdOperator": "GT",
      "warningThreshold": null,
      "triggerIds": [
        "1cd97784-3de4-4589-ae55-fb88615bb380"
      ],
      "tags": [
        "skill-run/v1"
      ],
      "name": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353: evidence failure; evidence trace f3b468fc5fbea7596f282d5f121c2492",
      "view": "scores-boolean",
      "metric": {
        "measure": "count",
        "aggregation": "count"
      },
      "filters": [
        {
          "column": "traceId",
          "operator": "=",
          "value": "f3b468fc5fbea7596f282d5f121c2492",
          "type": "string"
        },
        {
          "column": "name",
          "operator": "=",
          "value": "evidence-failure",
          "type": "string"
        },
        {
          "column": "booleanValue",
          "operator": "=",
          "value": true,
          "type": "boolean"
        }
      ],
      "alertThreshold": 0
    },
    "receipts": [
      {
        "monitorId": "cmvu2jaur0007p826ywo156bx",
        "monitorName": "pilot-90d35ed5-4bc8-4a29-bed2-70d5f298b353: evidence failure; evidence trace f3b468fc5fbea7596f282d5f121c2492",
        "severity": "ALERT",
        "metricValue": 1,
        "alertThreshold": 0,
        "thresholdOperator": "GT",
        "filters": [
          {
            "type": "boolean",
            "column": "booleanValue",
            "operator": "=",
            "value": true
          },
          {
            "column": "name",
            "operator": "=",
            "value": "evidence-failure",
            "type": "string"
          },
          {
            "column": "traceId",
            "operator": "=",
            "value": "f3b468fc5fbea7596f282d5f121c2492",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793306498749-1793310098749&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3Bf3b468fc5fbea7596f282d5f121c2492%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```

## live/18-threshold-read-fired.json

```json
[
  {
    "workflow": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922",
    "rule": {
      "projectId": "bakeoff-project",
      "window": "1h",
      "thresholdOperator": "GT",
      "warningThreshold": null,
      "triggerIds": [
        "b59ff8ee-5996-4da5-960e-db8c95d7566a"
      ],
      "tags": [
        "skill-run/v1"
      ],
      "name": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922: token warning; evidence trace 486b837ae52cc829b69e593018c82a50",
      "view": "scores-numeric",
      "metric": {
        "measure": "value",
        "aggregation": "sum"
      },
      "filters": [
        {
          "column": "traceId",
          "operator": "=",
          "value": "486b837ae52cc829b69e593018c82a50",
          "type": "string"
        },
        {
          "column": "name",
          "operator": "=",
          "value": "runtime-tokens",
          "type": "string"
        }
      ],
      "alertThreshold": 400
    },
    "receipts": [
      {
        "monitorId": "cmvu2p2yc0005p826x3rwmmt0",
        "monitorName": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922: token warning; evidence trace 486b837ae52cc829b69e593018c82a50",
        "severity": "ALERT",
        "metricValue": 480,
        "alertThreshold": 400,
        "thresholdOperator": "GT",
        "filters": [
          {
            "column": "name",
            "operator": "=",
            "value": "runtime-tokens",
            "type": "string"
          },
          {
            "column": "traceId",
            "operator": "=",
            "value": "486b837ae52cc829b69e593018c82a50",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793306856000-1793310456000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3B486b837ae52cc829b69e593018c82a50%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922",
    "rule": {
      "projectId": "bakeoff-project",
      "window": "1h",
      "thresholdOperator": "GT",
      "warningThreshold": null,
      "triggerIds": [
        "b59ff8ee-5996-4da5-960e-db8c95d7566a"
      ],
      "tags": [
        "skill-run/v1"
      ],
      "name": "verifier-hook-58d97f43-fd8b-431c-bee6-9aba132b4922: evidence failure; evidence trace 486b837ae52cc829b69e593018c82a50",
      "view": "scores-boolean",
      "metric": {
        "measure": "count",
        "aggregation": "count"
      },
      "filters": [
        {
          "column": "traceId",
          "operator": "=",
          "value": "486b837ae52cc829b69e593018c82a50",
          "type": "string"
        },
        {
          "column": "name",
          "operator": "=",
          "value": "evidence-failure",
          "type": "string"
        },
        {
          "column": "booleanValue",
          "operator": "=",
          "value": true,
          "type": "boolean"
        }
      ],
      "alertThreshold": 0
    },
    "receipts": []
  }
]
```

## services-after.json

```json
{
  "contextBefore": "colima-honcho",
  "contextAfter": "colima-honcho",
  "countBefore": 10,
  "countAfter": 10,
  "sameIds": true
}
```

The 480-token hook fixture is a separate parent/child accounting scenario with five measured requests and one failed request of unknown usage. The simpler replay/outage fixture independently remains at 240 tokens. No inference of doubled accounting is made from equal numeric totals in unrelated experiments.
