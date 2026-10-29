# Actual backend warning predicates

Adapter HEAD `b3ec6ad5b61097fe503e8b078a4083981f3b89a5`, tree `b693d38327ae9ecad46cc3f0c3e151ca31232ea4`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

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
    "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
    "view": "scores-numeric",
    "metric": {
      "measure": "value",
      "aggregation": "sum"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "e6d766829bcc7636b49fe3e3922983ec",
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
        "monitorId": "cmvu1pbhv0005p827dn4frghi",
        "monitorName": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe: token warning; evidence trace e6d766829bcc7636b49fe3e3922983ec",
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
            "value": "e6d766829bcc7636b49fe3e3922983ec",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793305156000-1793308756000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3Be6d766829bcc7636b49fe3e3922983ec%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
    "view": "scores-boolean",
    "metric": {
      "measure": "count",
      "aggregation": "count"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "e6d766829bcc7636b49fe3e3922983ec",
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
        "monitorId": "cmvu1pbi20007p8275v1hbe75",
        "monitorName": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe: evidence failure; evidence trace e6d766829bcc7636b49fe3e3922983ec",
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
            "value": "e6d766829bcc7636b49fe3e3922983ec",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793305140000-1793308740000&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3Be6d766829bcc7636b49fe3e3922983ec%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```

After the last replay:

```json
[
  {
    "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
    "view": "scores-numeric",
    "metric": {
      "measure": "value",
      "aggregation": "sum"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "e6d766829bcc7636b49fe3e3922983ec",
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
        "monitorId": "cmvu1pbhv0005p827dn4frghi",
        "monitorName": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe: token warning; evidence trace e6d766829bcc7636b49fe3e3922983ec",
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
            "value": "e6d766829bcc7636b49fe3e3922983ec",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793305156000-1793308756000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3Be6d766829bcc7636b49fe3e3922983ec%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe",
    "view": "scores-boolean",
    "metric": {
      "measure": "count",
      "aggregation": "count"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "e6d766829bcc7636b49fe3e3922983ec",
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
        "monitorId": "cmvu1pbi20007p8275v1hbe75",
        "monitorName": "pilot-a7f5d0d0-a692-440e-8fb0-8a3787518ebe: evidence failure; evidence trace e6d766829bcc7636b49fe3e3922983ec",
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
            "value": "e6d766829bcc7636b49fe3e3922983ec",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793305140000-1793308740000&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3Be6d766829bcc7636b49fe3e3922983ec%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```

Each receipt names the workflow, condition, metric, threshold, filters and evidence trace permalink. The localhost permalink is part of the backend payload; this published transcript is the reviewable evidence. Supplied evidence scores prove storage and alert predicates, not autonomous quality grading.
