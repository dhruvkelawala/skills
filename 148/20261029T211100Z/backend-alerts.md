# Actual backend warning predicates

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

The repository monitorRules definitions were configured once in the real isolated Langfuse backend. The normal scheduler delivered to the receiver inside the trial network. No receipt was injected. Early reads before evaluation failed and are excluded from successful proof.

The unchanged rules observed 240 > 100 measured tokens and 1 > 0 evidence failures after replay and outage recovery. After receipts were confirmed, another exact-event replay left exactly one ALERT per rule. The token budget is configurable and imposes no execution limit. Stable per-request scores provide authoritative usage; ordinary observation rows can temporarily repeat during replay.

```sh
SKILL_TOKEN_WARNING=100 SKILL_PILOT_STATE=<private-directory> python3 instrumentation/pilot/alerts.py configure
SKILL_PILOT_STATE=<same-directory> python3 instrumentation/pilot/alerts.py read
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-directory> python3 instrumentation/pilot/alerts.py read
```

Confirmed receipts before the last replay:

```json
[
  {
    "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
    "view": "scores-numeric",
    "metric": {
      "measure": "value",
      "aggregation": "sum"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "66b718016c78c3f1898fe6a5bf1a6914",
        "type": "string"
      },
      {
        "column": "name",
        "operator": "=",
        "value": "runtime-tokens",
        "type": "string"
      }
    ],
    "threshold": 100,
    "receipts": [
      {
        "monitorId": "cmvu1bho20005p826tfrpn7cq",
        "monitorName": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac: token warning; evidence trace 66b718016c78c3f1898fe6a5bf1a6914",
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
            "value": "66b718016c78c3f1898fe6a5bf1a6914",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793304475000-1793308075000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3B66b718016c78c3f1898fe6a5bf1a6914%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
    "view": "scores-boolean",
    "metric": {
      "measure": "count",
      "aggregation": "count"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "66b718016c78c3f1898fe6a5bf1a6914",
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
    "threshold": 0,
    "receipts": [
      {
        "monitorId": "cmvu1bho90007p826en5shxwo",
        "monitorName": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac: evidence failure; evidence trace 66b718016c78c3f1898fe6a5bf1a6914",
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
            "value": "66b718016c78c3f1898fe6a5bf1a6914",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793304500000-1793308100000&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3B66b718016c78c3f1898fe6a5bf1a6914%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```

After the last replay:

```json
[
  {
    "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
    "view": "scores-numeric",
    "metric": {
      "measure": "value",
      "aggregation": "sum"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "66b718016c78c3f1898fe6a5bf1a6914",
        "type": "string"
      },
      {
        "column": "name",
        "operator": "=",
        "value": "runtime-tokens",
        "type": "string"
      }
    ],
    "threshold": 100,
    "receipts": [
      {
        "monitorId": "cmvu1bho20005p826tfrpn7cq",
        "monitorName": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac: token warning; evidence trace 66b718016c78c3f1898fe6a5bf1a6914",
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
            "value": "66b718016c78c3f1898fe6a5bf1a6914",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793304475000-1793308075000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3B66b718016c78c3f1898fe6a5bf1a6914%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac",
    "view": "scores-boolean",
    "metric": {
      "measure": "count",
      "aggregation": "count"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "66b718016c78c3f1898fe6a5bf1a6914",
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
    "threshold": 0,
    "receipts": [
      {
        "monitorId": "cmvu1bho90007p826en5shxwo",
        "monitorName": "pilot-3415d642-e2c5-4aa0-ab07-7723adb069ac: evidence failure; evidence trace 66b718016c78c3f1898fe6a5bf1a6914",
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
            "value": "66b718016c78c3f1898fe6a5bf1a6914",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793304500000-1793308100000&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3B66b718016c78c3f1898fe6a5bf1a6914%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```

Each receipt names the workflow, condition, metric, threshold, filters and evidence trace permalink. The localhost permalink is part of the backend payload; this published transcript is the reviewable evidence. Supplied evidence scores prove storage and alert predicates, not autonomous quality grading.
