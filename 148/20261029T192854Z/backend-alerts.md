# Actual backend warning predicates

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

The repository monitorRules definitions were configured through the isolated backend's authenticated API. The normal monitor scheduler evaluated them and delivered to an HTTP receiver inside the trial network. No receipt was injected.

```sh
SKILL_TOKEN_WARNING=100 SKILL_PILOT_STATE=<private-directory> python3 instrumentation/pilot/alerts.py configure
SKILL_PILOT_STATE=<same-directory> python3 instrumentation/pilot/alerts.py read
SKILL_PILOT_STATE=<same-directory> node instrumentation/pilot/probe.mjs replay
SKILL_PILOT_STATE=<same-directory> python3 instrumentation/pilot/alerts.py read
```

The token rule observed 240 > 100; the evidence-failure rule observed 1 > 0. Both rules scope to this workflow trace and score name. The evidence rule also filters booleanValue=true. After exact-event replay and outage recovery, each unchanged rule still had exactly one unresolved ALERT receipt. Initial reads before scheduler completion failed and were not counted as successful proof.

```json
[
  {
    "workflow": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6",
    "view": "scores-numeric",
    "metric": {
      "measure": "value",
      "aggregation": "sum"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "5c13a62f5d1f586b4412a63cdfe99471",
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
        "monitorId": "cmvtxl4lj000bp8279f5uoktj",
        "monitorName": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6: token warning; evidence trace 5c13a62f5d1f586b4412a63cdfe99471",
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
            "value": "5c13a62f5d1f586b4412a63cdfe99471",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793298212000-1793301812000&filter=name%3Bstring%3B%3B%3D%3Bruntime-tokens%2CtraceId%3Bstring%3B%3B%3D%3B5c13a62f5d1f586b4412a63cdfe99471%2CdataType%3BstringOptions%3B%3Bany+of%3BNUMERIC%257CBOOLEAN&showAllEnvironments=true"
      }
    ]
  },
  {
    "workflow": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6",
    "view": "scores-boolean",
    "metric": {
      "measure": "count",
      "aggregation": "count"
    },
    "filters": [
      {
        "column": "traceId",
        "operator": "=",
        "value": "5c13a62f5d1f586b4412a63cdfe99471",
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
        "monitorId": "cmvtxl4ls000dp827b4tu1lge",
        "monitorName": "pilot-36f3e3a3-2fb0-48ba-a847-f869f33e34d6: evidence failure; evidence trace 5c13a62f5d1f586b4412a63cdfe99471",
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
            "value": "5c13a62f5d1f586b4412a63cdfe99471",
            "type": "string"
          }
        ],
        "dataPermalink": "http://localhost:3307/project/bakeoff-project/scores?dateRange=1793298238000-1793301838000&filter=value%3Bnumber%3B%3B%3D%3B1%2Cname%3Bstring%3B%3B%3D%3Bevidence-failure%2CtraceId%3Bstring%3B%3B%3D%3B5c13a62f5d1f586b4412a63cdfe99471%2CdataType%3Bstring%3B%3B%3D%3BBOOLEAN&showAllEnvironments=true"
      }
    ]
  }
]
```
The receipt names the workflow, condition, threshold, filters and evidence trace permalink. The localhost permalink is a backend reference in the payload; this published transcript is the reviewable evidence. Warning budgets are configurable and do not limit task execution.
