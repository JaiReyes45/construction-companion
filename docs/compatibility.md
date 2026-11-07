# Compatibility evidence

Status: development, not a user-ready release.

| Host | Version | Native hooks | Game questions | Package installation |
|---|---|---|---|---|
| Codex CLI | 0.155.1 discovered locally | Unverified | Native-chat fallback | Unverified |
| Claude Code | Not installed locally | Unverified | Native-chat fallback | Unverified |

Version discovery is not an integration test. Codex uses `plugin add`; Claude uses `plugin install`. Native receipts must establish package trust, context correlation and question delivery for each claimed version/platform. Run `node scripts/probe-host.mjs --host codex --isolated` for non-mutating discovery.
