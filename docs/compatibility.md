# Compatibility evidence

Status: development, not a user-ready release.

| Host | Version | Native hooks | Game questions | Package installation / MCP |
|---|---|---|---|---|
| Codex CLI / Windows | 0.155.1 | Unverified: isolated hook discovery returned no hooks | Native-chat fallback | Isolated native add, 13-tool discovery and status call passed on development package |
| Claude Code | Not installed locally | Unverified | Native-chat fallback | Unverified |

Version discovery is not an integration test. Codex uses `plugin add`; Claude uses `plugin install`. Native receipts must establish package trust, context correlation and question delivery for each claimed version/platform. Run `node scripts/probe-host.mjs --host codex --isolated` for non-mutating discovery.

The native Codex probe used its app-server protocol in an isolated CODEX_HOME and made no model request. It did not bypass hook trust. Standalone MCP fixtures pass for both generated packages, but Claude is not installed here. Node 22.16.0 and Edge 156.0.4314.58 were exercised on Windows. CI defines Windows/Linux checks; a workflow file is not evidence that those CI jobs have run.

No capability currently has a complete two-host user-ready claim. Source preview users can run the labelled local demo with `node scripts/demo.mjs --copy-token`. Its simulated questions do not alter native compatibility status.
