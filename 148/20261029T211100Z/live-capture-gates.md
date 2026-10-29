# Current supported setup and incomplete live criterion

Adapter HEAD `588919b69aab3fe3f409552dab718ce1c5b6c3d9`, tree `7346052301582e370b4ff289266ab57d7a6d398a`. Captured on 2026-10-29 through the repository commands and actual Langfuse APIs. Credentials and raw private transcripts are excluded.

The current setup commands ran in a private temporary project with the original disabled configuration. Exact generated files were inspected and hash-removed. The build worktree has no generated hooks; original capture configs remain disabled. No trust mutation or bypass was used.

```sh
node instrumentation/pilot/setup.mjs create claude <temporary-project> <disabled-config>
node instrumentation/pilot/setup.mjs remove claude <temporary-project> <disabled-config>
node instrumentation/pilot/setup.mjs create codex <temporary-project> <disabled-config>
node instrumentation/pilot/setup.mjs remove codex <temporary-project> <disabled-config>
codex --version
```

```json
{
  "capturedHead": "588919b69aab3fe3f409552dab718ce1c5b6c3d9",
  "phase": "supported-configuration-inventory",
  "codexVersion": "codex-cli 0.164.0",
  "generated": [
    {
      "runtime": "claude",
      "sha256": "81a2c387dc7a14d1b79d062d1e64849387e26e23d52d44a49a6a2bb1f061d3da",
      "timeouts": {
        "Stop": 15,
        "SessionEnd": 15
      },
      "trusted": "unassessed",
      "removedByExactHash": true
    },
    {
      "runtime": "codex",
      "sha256": "5fdcbd040d42efc074184da21f6fbc994c106692a1be40e16436206a3db6dc48",
      "timeouts": {
        "Stop": 15,
        "SessionEnd": 3
      },
      "trusted": "unassessed",
      "removedByExactHash": true
    }
  ],
  "projectHooksPresent": [],
  "privateConfigs": [
    {
      "name": "issue-config.json",
      "enabled": false
    },
    {
      "name": "research-config.json",
      "enabled": false
    }
  ],
  "providerCodexHomeExposed": false,
  "liveCriterion": "incomplete",
  "blockers": [
    "No supported same-T3-provider-profile exact-definition /hooks review path established; app-server schema exposes hooks/list only.",
    "Current capture requires exact context.session binding before transcript access. A supported T3 prelaunch session-binding interface was not established.",
    "Sonnet12/13 direct capture predates the binding guard; no current full live capture, live interruption/resumption or inclusive live child accounting proof."
  ],
  "trustMutationUsed": false,
  "bypassUsed": false,
  "clientMethodCount": 106,
  "hookMethods": [
    "hooks/list"
  ],
  "trustMethods": []
}
```

The existing schema inventory came from installed Codex 0.164.0. It exposes hooks/list and no hook-trust mutation method; this does not establish T3's actual hook state. Official docs require project-layer trust and exact-definition review through /hooks. Generic config-write methods were not tested as trust mutations.

AC8 remains incomplete. Current capture needs an exact session bound before launch and same-profile supported hook review. Neither path was established in T3. The historical Sonnet 12/13 live snapshot predates the session guard. Full current live Sol/Sonnet capture, interruption/resumption and inclusive live child usage remain unproved. No trust record or global provider configuration was changed.
