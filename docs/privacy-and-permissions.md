# Privacy and permissions

The dashboard binds only to 127.0.0.1 on an OS-selected port. Browser and ingestion credentials are separate random 256-bit tokens. They are stored in private per-user data, never in a URL or source configuration. Browser credentials stay in memory, not localStorage. Windows setup restricts inheritance to the current account; `doctor` reports unsafe or unverified ACLs. Users and processes running as the same OS account remain trusted local principals.

Hooks retain allowlisted event IDs, task/actor IDs, timestamps and status metadata. They discard prompt text, tool arguments, transcripts and arbitrary nested payloads. SQLite stores activity metadata and question/answer content. Local history persists across restarts; uninstall retains it. There is no telemetry endpoint or hosted account dependency.

Memory starts disabled. The browser can enable it and select a vault parent; the service creates a distinct project subfolder. It writes only known owned Markdown pages, uses hashes and backups, rejects path escapes and does not ingest unrelated notes. Retrieved context is limited to 8 KiB, including attribution, and is untrusted reference data.

Skill metadata is not execution authority. Installation needs a separate affirmative review for the exact source, revision, destination and command, followed by native host permission and verification. This release enables no automatic third-party installation recipes. The game cannot approve a shell command.

Animation and routing make zero model requests. Your host's normal work still incurs its normal usage. The companion does not claim token savings without measurements from the host.
