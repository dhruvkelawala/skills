# Codex hook trust boundary

For issue #148, the supported project-hook setup is prepared. Direct live Codex capture remains incomplete.

The installed research skill was run in a fresh T3 Sonnet 5.5 task on 2026-10-29. It fetched the [official hooks page](https://learn.chatgpt.com/docs/hooks), inspected method and field names in the generated app-server schema, and wrote this artifact. The source HTML returned HTTP 200, 528,922 bytes, SHA256 `d83234bb8c5c85be8eccc258bf5a9e95c713ba953b41740d0a184f2cece3f880`. The owning build checked the statements below against that retained HTML and shortened the artifact. Claim-support quality remains unassessed.

The documentation says:

- “Project-local hooks load only when the project `.codex/` layer is trusted.”
- “Before a non-managed hook can run, Codex requires you to review and trust the exact hook definition.”
- New or changed definitions “are marked for review and skipped until trusted.” Trust follows the definition hash.
- `/hooks` provides interactive inspection and review.
- “SessionEnd and Interrupt use 1 second by default and support up to 3 seconds.” The generated pilot SessionEnd hook uses three seconds.

This pilot requires supported exact-definition review in T3's actual Codex profile. It excludes the documented bypass flag and direct writes to trust records. T3's provider CODEX_HOME is not exposed in this shell. Trusting a different CLI profile would not prove that T3's hook is trusted.

The schema generated from installed `codex-cli 0.164.0` declares 106 client methods. Its only hook method is `hooks/list`; the response includes `trustStatus` and `currentHash`. No method name contains `trust`. Generic configuration-write methods exist, but neither the research task nor the owning build tested them as trust mutations or treats them as a supported review path. Schema inspection does not establish T3's actual hook state.

The research task deliberately ran `node -e 'process.exit(1)'`, then recovered through a successful page fetch and schema checks. That expected error does not establish workflow failure. It started no children. Its artifact/source marker reached Langfuse with outcome unknown.

Automatic Claude hooks delivered twelve of thirteen source requests directly from this T3 research task to Langfuse. The final request was absent. A later, explicitly separate completed-transcript adapter replay recovered all thirteen requests and matched independent source counters. Neither result proves complete automatic capture, Codex delivery, child linkage, or interruption/resumption. See the [pilot report](../instrumentation/pilot/report.md) for the measured boundary.
