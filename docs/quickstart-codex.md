# Codex on Windows

Verified target: Codex CLI 0.155.1, Windows, Node 22.16.0. Node 22.13+ is required. Codex desktop, other host versions, macOS/Linux native behavior, and Claude native sessions have not passed this acceptance run.

## 1. Build and install

Install Node, Git and Codex, sign into Codex normally, and install genuine [Superpowers](https://github.com/obra/superpowers) through your host. Check `node --version` and `codex --version`.

From PowerShell:

```powershell
git clone https://github.com/JaiReyes45/construction-companion.git
cd construction-companion
npm.cmd ci --ignore-scripts
node scripts/build-packages.mjs
$project = "C:\Projects\my-website"
node bin/construction-companion.mjs install --host codex --project "$project"
node bin/construction-companion.mjs install --host codex --project "$project" --apply
```

Choose an existing project folder. The first install command previews the exact paths; the second applies them. Setup copies the package into the ignored `.construction-companion/codex` folder, preserves existing marketplace/config entries, and records its changes privately. Native registration creates one disabled user-wide entry. Only this project's `.codex/config.toml` enables it. Hook trust is never granted by the installer.

For a downloaded, extracted Codex package, run its `bin/construction-companion.mjs` and supply `--package "<extracted construction-companion folder>"` on the install command; its dependencies are already bundled. This project is not on npm: no `npx construction-companion` command is supported.

## 2. Make installed skills available to the crew

This step reads skill metadata; it does not install or execute skills. Pass collection folders containing individual skill directories, not one `SKILL.md` file. Repeat `--skill-root` for additional collections; the supplied list replaces the prior list.

```powershell
node bin/construction-companion.mjs configure --project "$project" --skill-root "C:\path\to\installed-skills" --skill-root "C:\path\to\superpowers\skills"
```

UI/UX Pro Max is optional. Install third-party skills through their genuine upstream instructions and your coding host's permissions. The current catalog offers manual installation; it has no enabled automatic third-party install recipe. Configuring a collection does not make an uninstalled skill available to Codex.

## 3. Open the site and the coding host

Keep the companion checkout or extracted package available:

```powershell
node bin/construction-companion.mjs start --project "$project"
node bin/construction-companion.mjs connect --project "$project" --copy-token
```

Open the printed local URL, paste the token into **Local connection token**, and select **Connect**. In a separate terminal:

```powershell
cd "C:\Projects\my-website"
codex --enable hooks
```

Review the project trust and the companion's hook commands using Codex's native controls (`/hooks`). Review native tool requests in Codex as they appear. If a skill file read is blocked by the Windows sandbox, have Codex request permission for that exact read; no full-access mode is needed. Node must be on Codex's PATH for hooks.

Prompt normally: **“I want to build a website for my bakery. Help me plan it.”** The head engineer can ask questions and recommend an architect skill. Choose **Use installed**, **Choose another skill**, or **Continue without**. Use the **Project session** selector when several chats are present.

Answers wait up to 45 seconds. A timeout returns the question to native chat. An interrupt cancels the game question; answer the new/current question instead. Execution approvals always stay in Codex.

## 4. Notebook, checks and stopping

Optionally enable **Save approved project decisions** and save the preference. Notes are Markdown and can be opened in Obsidian. Capture defaults off; opting out stops new capture without deleting old notes. An editor conflict preserves your changes for reconciliation.

```powershell
node bin/construction-companion.mjs doctor --host codex --project "$project"
node bin/construction-companion.mjs stop --project "$project"
```

`doctor` distinguishes supported version/platform, runner state, private storage, and indexed skills. It cannot prove you have granted native hook trust. After a runner restart, reconnect with a newly copied token. After changing skill roots, stop/start the runner. Moving the project or its retained package requires reinstalling because the native MCP entry points to that project copy.

See [removal and recovery](uninstall.md), [compatibility](compatibility.md), and the official [plugin packaging](https://developers.openai.com/plugins/build/plugins) and [hook trust](https://learn.chatgpt.com/docs/hooks) references.
