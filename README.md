# Construction Companion

A tiny construction site beside your coding agent. You are the project owner; Superpowers guides the conversation as head engineer, and selected skills become your crew.

**V2 development preview.** The local dashboard, question broker, skill-choice workflow, project memory and standalone MCP packages are implemented and tested. Native Codex package registration has been exercised on Windows. End-to-end ordinary-prompt discovery and game replies are **not yet verified** in Codex or Claude Code. Native installations keep questions in the host chat until that gate passes. This is not yet the complete two-host user-ready release.

The companion makes no model API calls. Your coding host still runs the work and uses its normal subscription or API allowance. Selected workers are not independent models. Pixel animation uses local Canvas drawing.

## Try the source preview

Prerequisites: Node.js 22.13 or newer (22.16 tested), npm, Git, and your chosen coding host. Install genuine [Superpowers](https://github.com/obra/superpowers) through that host if you want it to guide the workflow. Obsidian is optional.

```sh
git clone https://github.com/JaiReyes45/construction-companion.git
cd construction-companion
npm ci --ignore-scripts
node scripts/build-packages.mjs
node bin/construction-companion.mjs install --host codex --project "/absolute/path/to/your/project"
```

Read the setup preview, then repeat the final command with `--apply`. Review the companion's hooks through your coding host's native trust screen and restart the host.

```sh
node bin/construction-companion.mjs start --project "/absolute/path/to/your/project"
node bin/construction-companion.mjs connect --project "/absolute/path/to/your/project" --copy-token
```

Open the printed local URL. Paste the copied token into **Local connection token**, then choose **Connect**. Keep the terminal/source checkout available. Continue prompting your coding agent as usual. The site displays activity supplied by its enabled hooks; unsupported questions stay in native chat.

Windows paths with spaces work when quoted. This package is not published on npm; there is no supported `npx construction-companion` installation.

## What the intended workflow looks like

1. Tell the coding host what you want to build, for example a website for a local business.
2. Superpowers asks discovery questions. Verified game transport will show those questions beside the head engineer; this preview uses native chat for real host sessions.
3. The head engineer can recommend up to three skills for a role. Choose an installed skill, review a proposed installation, choose another, or continue without one.
4. Selected skills stand ready. Observed task activity drives the site; selected or agent-declared activity is not proof of a completed task.
5. Optionally enable **Project notebook** to save approved decisions as project-scoped Markdown. You can open the folder in Obsidian. Full chat transcripts are not copied.

Native command permissions always stay in your coding host. Third-party skills are never installed simply because a recommendation appears. The UI/UX Pro Max catalog entry currently links to manual upstream setup; no automatic recipe is enabled.

## Guides

- [Codex setup](docs/quickstart-codex.md) · [Claude setup and limits](docs/quickstart-claude.md)
- [Compatibility and evidence](docs/compatibility.md) · [Acceptance checklist](docs/acceptance.md)
- [Tutorial](docs/tutorial.md) · [Architecture](docs/architecture.md)
- [Privacy and permissions](docs/privacy-and-permissions.md) · [Removal and recovery](docs/uninstall.md)

## Development

```sh
npm test
node scripts/release-check.mjs
```

Tests use temporary folders, local loopback servers, Windows junction fixtures and child Node processes. Allow those in your development sandbox. The package-copy test is intentionally slower: it starts MCP tools from independent copied directories.

MIT code; original CC0 pixel sprites. See [third-party notices](THIRD_PARTY_NOTICES.md). The [preserved V1 CRM prototype](https://github.com/JaiReyes45/AI-Automation-BasicProjects/tree/construction-crm-v1-prototype-verified/prototypes/construction-crm-v1) remains separate.
