# Claude Code preview

Claude Code is not installed in the development machine used for this preview, so native Claude support is unverified. The generated standalone MCP package was exercised with the official MCP client, not a Claude session.

Build from source, then run `node bin/construction-companion.mjs install --host claude --project "/absolute/project"`. The preview shows native command arrays. Applying requires Claude on PATH, registers the local package marketplace, and uses `claude plugin install ... --scope local`. Package discovery can be user-wide; activation must be local to the selected project. Review native hooks and restart Claude. See [Claude's plugin reference](https://code.claude.com/docs/en/plugins-reference).

Use the same `start`, `connect --copy-token`, `doctor` and `stop` commands as Codex. Game questions remain in native chat. Claude turn correlation and interrupt handling need native validation before question delivery can be enabled; this preview does not guess a turn from the latest session.

Complete the [acceptance checklist](acceptance.md) on the exact Claude version and platform before advertising support.
