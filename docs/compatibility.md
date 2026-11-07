# Compatibility and evidence

V0.2 targets **Codex CLI 0.155.1 on Windows**. Exact version matching is intentional: a newer version is not evidence of an unchanged native protocol.

| Host | Native status | Questions |
|---|---|---|
| Codex CLI 0.155.1 / Windows | Real native hooks, MCP, Superpowers discovery, browser answers, skill choices and notebook exercised | Up to 45 seconds, then native-chat fallback |
| Other Codex versions / platforms | Unverified | Native chat |
| Claude Code 2.1.319 / Windows | Binary available; no signed-in account for native acceptance | Native chat |
| Codex desktop application | Not separately verified | No desktop-specific claim |

The ordinary-prompt test used the owner's existing Codex allowance with a supported native model (`gpt-6-sol`), genuine installed Superpowers, and a disposable project. Only reviewed hook hashes were trusted in that process. The native harness accepted the already-authorized companion tools and exact installed skill-file reads; unrelated permissions stayed blocked. No credentials were copied into releases.

Observed checks include a browser answer used by the model in the same turn, interruption with late answer rejection, installed skill acceptance/alternative/decline and decline suppression, and a measured 45,039 ms question timeout returning once to native chat. Notebook checks exercised browser consent, approved summary write/read, editor conflict preservation, reconciliation, and opt-out through the real MCP server. Native stop/restart checks exercised fallback, token rotation, replay rejection, and retained sessions.

Generated packages contain 13 MCP tools and 10 lifecycle hooks. Codex 0.155.1's root `plugin.json` format deliberately omits hooks, so this package uses `.codex-plugin/plugin.json`. Its legacy MCP loader does not expand `PLUGIN_ROOT` in arguments; setup binds the retained project copy. Windows hook launchers resolve the plugin root in Node because native hooks may run in PowerShell or cmd. These details were verified against [Codex rust-v0.155.1 source](https://github.com/openai/codex/tree/rust-v0.155.1).

Limits: no long-running question wait, automatic third-party install recipe, independent worker agents, verified desktop integration, or cross-platform native claim. Animation makes no model requests; normal coding-host work uses the host's allowance. Native permission hooks may lack a tool ID, so the site refers users to the host for current permission status. Concurrent observational hooks can lose activity metadata; the site displays a history-gap notice and does not invent completion or usage totals.

Automated tests and CI remain distinct from native acceptance. The old [preview evidence](evidence/preview-2026-11-08.json) is retained as history; new release receipts must match the final package hash before promotion.
