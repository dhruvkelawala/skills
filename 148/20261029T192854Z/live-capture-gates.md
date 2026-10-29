# Current supported setup and incomplete live criterion

Adapter HEAD `e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068`, tree `22e7d1c338bc652ac90421f30154985c64630b5f`. Captured on 2026-10-29 through the repository CLI or actual Langfuse public APIs. Private credentials and transcripts are excluded.

Current setup was exercised in a private temporary project using a disabled private configuration. Generated files were inspected and removed only after exact hash comparison. Neither command establishes trust. The actual build worktree has no generated project hooks, and its original configurations remain disabled.

```sh
node instrumentation/pilot/setup.mjs create claude <temporary-project> <disabled-private-config>
node instrumentation/pilot/setup.mjs remove claude <temporary-project> <disabled-private-config>
node instrumentation/pilot/setup.mjs create codex <temporary-project> <disabled-private-config>
node instrumentation/pilot/setup.mjs remove codex <temporary-project> <disabled-private-config>
codex --version
```

```json
{
  "capturedHead": "e30ef4e7f6fc3a5b4b2c711dc7e67852458f4068",
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
The schema inventory was generated from installed Codex 0.164.0 and inspected for exact method names. It does not establish T3's live hook state. Official documentation requires project-layer trust and review of each exact hook definition through /hooks; changing the definition hash requires another review. Generic config-write methods were not tested or treated as trust mutation.

The implementation/configuration is reviewable. AC8 remains incomplete. A supported same-provider-profile review path and exact prelaunch session binding must be established before another current-code live probe. No bypass flag, trust-file patch, global provider edit or historical-session scan was used. The Sonnet12/13 snapshot remains earlier partial live evidence.
