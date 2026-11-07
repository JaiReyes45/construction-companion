# Codex source preview

Follow the source build commands in the README. Run `install --host codex --project "..."` to preview, then add `--apply`.

Setup copies the built package into the selected project's ignored `.construction-companion/codex` directory, adds one entry to its `.agents/plugins/marketplace.json`, and appends one owned plugin block to `.codex/config.toml`. It preserves other marketplace entries and config text. Codex loads project config only for trusted projects. Review the project and plugin hooks through Codex's native trust controls; the companion does not bypass them.

The native `codex plugin add` command was verified in an isolated CODEX_HOME on 0.155.1, but it writes a user-wide enabled entry. Our project installer uses the documented repo marketplace and project enablement instead. See [OpenAI's plugin packaging reference](https://developers.openai.com/plugins/build/plugins) and [hook trust reference](https://learn.chatgpt.com/docs/hooks).

Run `start`, then `connect --copy-token`, with the same project path. Paste the token into the printed local page. Hooks only observe projects enabled by a private install receipt. Node must remain on the host's PATH. Running source files does not install this plugin into the current desktop chat automatically.

`doctor --host codex --project "..."` reports host discovery, service connection and native question limitations. Isolated native MCP discovery and a status call passed on the final preview package. Hook discovery returned no hooks; hook trust, ordinary prompts and browser answer delivery still need final acceptance. A successful source fixture is not that evidence.

Installed skill roots are explicit private configuration in `project.json` under the runner's per-project data directory. Add only skill directories you intend the companion to index to its `skillRoots` array. No whole home directory or Obsidian vault is scanned for skills.
