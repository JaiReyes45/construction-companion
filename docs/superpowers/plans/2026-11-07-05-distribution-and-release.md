# Distribution and release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a documented open-source companion with reversible setup and honestly verified host compatibility.

**Architecture:** Generate separate host packages around the same local core, then expose a source-install CLI for project setup, start, doctor and removal. Native-host acceptance evidence gates each advertised capability.

**Tech Stack:** Existing Node package/lockfile; native host plugin commands; GitHub source distribution and CI. No default Docker, CRM, HubSpot, GHL or hosted account dependency.

**Spec:** `../specs/2026-11-07-construction-companion-v2-design.md`; types in `2026-11-07-construction-companion-contracts.md`. Depends on Plans 00–04.

## Global Constraints

- User-ready compatibility requires native-host evidence on every advertised host/version/platform. Fixture tests alone do not qualify a host. Unsupported or unverified capabilities are labelled explicitly.
- The existing coding host owns execution. The companion creates no model session or model API request.
- V2 lives in its own construction-companion repository. V1 source, services, history and public prototype tags are preserved.
- Default service binding is 127.0.0.1 on an OS-assigned port; no LAN binding. Use separate random 256-bit ingest and browser tokens, private per-user storage outside the repository and OneDrive, and explicit browser connection. Do not put tokens in URLs, logs or committed configuration.
- Newly authored code uses MIT; preserve original CC0 sprite credit and verified third-party notices. Do not redistribute the Obsidian app or coding models.

## Review Focus

- Project paths containing spaces and native command differences must not break installation — Tasks 1 and 2.
- Uninstall must preserve user edits, other plugins and project notes — Task 2.
- Multiple host sessions and repeated starts must share the intended service without port/database conflicts — Task 2.
- Missing dependencies and unavailable native-host tests must be visible release limitations — Tasks 2 and 3.
- A public archive must contain no runtime databases, user contact details, private receipts or tokens — Task 3.

---

### Task 1: Deterministic host packages

**Files:** Create `scripts/build-packages.mjs`, `packaging/codex.mjs`, `packaging/claude.mjs`, `test/packages.test.mjs`, `LICENSE`, `THIRD_PARTY_NOTICES.md`; modify `package.json`, `.gitignore`.

**Interfaces:** Consumes the measured schema/capability receipts from Plan 00 and source runtime/skill/assets. Produces `buildPackages({sourceRoot,outputRoot,version}): Promise<{codexRoot,claudeRoot,hashes}>`. Separate generated package directories must be self-contained after copying, with no symlink to this checkout.

Define test-local `inspectPackageFixture(root)` to enumerate actual generated files and parse manifests; return `{unresolvedManifestPaths,privateFiles,hasMcpEntrypoint}`. It checks contents, not a builder-provided success flag.

- [ ] Write `test/packages.test.mjs`: generation in a path containing spaces is deterministic; each package contains runnable MCP/hook entrypoints, skill instructions, sprite credits and its host manifest; all declared paths resolve inside the package; no `.scratch`, DB, token, `.env`, owner-specific absolute path or bundled model credentials is present; a copied standalone package starts its MCP status fixture; manifests validate against measured host schemas. Assert Codex commands use `plugin add`, and Claude commands use `plugin install`, not a shared assumed syntax.
```js
test('copied packages contain no owner paths or runtime secrets', async t => {
  const outputRoot = temporaryDirectory(t);
  const result = await buildPackages({sourceRoot:process.cwd(),outputRoot,version:'0.1.0-preview.1'});
  const f = await inspectPackageFixture(result.codexRoot);
  assert.deepEqual(f.unresolvedManifestPaths,[]);
  assert.deepEqual(f.privateFiles,[]);
  assert.equal(f.hasMcpEntrypoint,true);
});
```

- [ ] Run `node --test test/packages.test.mjs`. Expect missing package builder/manifests.
- [ ] Implement generation: Codex package includes portable `plugin.json`, explicit-transport `mcp.json`, `.codex-plugin/plugin.json`, `hooks/hooks.json`, `skills/` and shared runtime; Claude package includes `.claude-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`, `skills/` and the same runtime. Render the exact schema supported by the version actually probed; package validation must fail rather than silently dropping required hooks. Hook commands invoke a fixed entrypoint with `--host codex` or `--host claude`, not interpolated event data. Preserve per-host protocol output differences. Copy the pinned production dependency tree and applicable license files into each generated package without symlinks; build dependencies using `npm ci --omit=dev --ignore-scripts` in staging, never on a hook invocation. Include package metadata/lockfile and verify copied packages actually run without access to the source checkout. Keep local-marketplace registration separate from plugin contents. Add MIT license/CC0 notices; reference upstream Superpowers as an external workflow dependency, not bundled copied prompts. Pin dependencies and document installation/build prerequisites. Local hook plugins are distributed through GitHub/local marketplace; do not promise acceptance into OpenAI's universal public plugin directory.
- [ ] Run `node --test test/packages.test.mjs` and native isolated package validation in each available host. Expect standalone status and schema success for hosts marked verified; an unavailable host remains unverified.
- [ ] Stage task files and commit with `git commit -m "feat: build separate portable Codex and Claude packages"`.

### Task 2: Project setup, singleton lifecycle, doctor and reversible removal

**Files:** Create `bin/construction-companion.mjs`, `src/cli.mjs`, `src/install.mjs`, `src/lifecycle.mjs`, `test/install.test.mjs`, `test/lifecycle.test.mjs`, `docs/quickstart-codex.md`, `docs/quickstart-claude.md`, `docs/uninstall.md`; modify `src/compat.mjs`, `src/private-paths.mjs`.

**Interfaces:** Produces `runCli(argv,{run,stdout,stderr,clipboard}): Promise<number>`, `planInstall({host,projectRoot,packageRoot,capability}): InstallPlan`, `applyInstall(plan,{run,receiptRoot}): Promise<Receipt>`, `uninstall({receipt,run}): Promise<{removed,preserved,conflicts}>`, `startProject({projectRoot,paths}): Promise<{origin,alreadyRunning}>`, `stopProject({projectRoot,paths}): Promise<void>`, `doctor({projectRoot,host,run}): Promise<DoctorReport>`. `InstallPlan` contains exact command arrays/config changes/scope/hashes; `Receipt` records owned changes and prior hashes in private storage. `DoctorReport` contains status per capability with evidence dates and actionable reasons, never secrets.

Define test-local `installFixture(t)` with temporary package/project/host homes, a recorded injected runner and existing unrelated settings; return `{projectRoot,packageRoot,capability,runCalls,readSettings,originalSettings}`. `InstallPlan.activationScope` contains the host's concrete activation value (`local` for Claude); it is separate from user-wide package storage.

- [ ] Write `test/install.test.mjs`: preview makes no changes; applying registers only the chosen project, preserves unrelated configuration, records before/after hashes, handles a spaced Windows path without shell parsing, and uses the native command for the chosen host; another installed plugin/version is never overwritten implicitly. Uninstall removes only unchanged owned entries, preserves externally edited entries with conflict guidance, retains code/vault, and does not remove a shared package used by another project. Write `test/lifecycle.test.mjs`: concurrent starts return one service; stale lock recovery verifies process identity, not PID alone; restart restores state with old questions cancelled; stop is bounded; doctor reports missing Node/host/Superpowers, unsafe storage ACLs, disconnected service and unverified question support accurately. Test redacted output and no tokens in URLs/logs.
```js
test('setup preview is project-scoped and does not execute changes', async t => {
  const f = await installFixture(t);
  const plan = planInstall({host:'claude',projectRoot:f.projectRoot,packageRoot:f.packageRoot,capability:f.capability});
  assert.equal(plan.activationScope,'local');
  assert.equal(f.runCalls.length,0);
  assert.deepEqual(await f.readSettings(),f.originalSettings);
});
```

- [ ] Run `node --test test/install.test.mjs test/lifecycle.test.mjs`. Expect missing CLI/lifecycle modules.
- [ ] Implement the source CLI commands: `install --host <codex|claude> --project <path>` previews; `install ... --apply` applies the reviewed own-plugin setup; `start --project <path>`, `stop --project <path>`, `doctor --host <host> --project <path>`, `connect --project <path> --copy-token`, `uninstall --project <path>`. Installation prints package storage, activation scope, hook trust requirements and exact changed files before apply. Use native plugin registration where verified; Codex project activation can use its supported `.codex/config.toml` plugin enablement, Claude uses `--scope local`. Never silently turn on a shared/user-wide hook when only project setup was chosen. Use parse/merge and compare hashes or native registration, never replace an entire settings file. OS-private receipts and credentials have restrictive permissions; check Windows ACLs as well as POSIX modes. `connect --copy-token` is an explicit local clipboard action, never part of a URL or routine tool output. Singleton locks are scoped by canonical project identity, support multiple host sessions, and are released cleanly. MCP session context and spool ingestion use the registered service and its private launch data. Avoid duplicate drain loops, writers or orphan processes. Implement conservative data retention: stop cancels questions; uninstall retains notes and private history unless the user separately requests deletion. Write working quickstarts from the tested command outputs, including hook trust and next-session/reload requirements.
- [ ] Run `node --test test/install.test.mjs test/lifecycle.test.mjs test/packages.test.mjs`. Perform clean install/start/doctor/stop/uninstall in isolated fixtures on Windows and Linux before advertising either platform. Expect no remaining owned hooks/config after clean removal, and intact user code/notes/other plugins.
- [ ] Stage task files and commit with `git commit -m "feat: install and remove project companions reversibly"`.

### Task 3: Native acceptance, tutorial and open-source delivery

**Files:** Create `scripts/release-check.mjs`, `test/release-check.test.mjs`, `examples/website-brief.md`, `docs/acceptance.md`, `docs/tutorial.md`, `docs/privacy-and-permissions.md`, `docs/architecture.md`, `CONTRIBUTING.md`, `SECURITY.md`, `README.md`, `.github/workflows/ci.yml`; modify `docs/compatibility.md`, `PLANNING-STATUS.md`, `THIRD_PARTY_NOTICES.md`.

**Interfaces:** Consumes package hashes, sanitized native/UI receipts and `Capability[]`. Produces `checkRelease({root,claims,evidence}): Promise<{ready,blockers,warnings}>` and a CLI exit status: 0 only when all declared ready capabilities have matching successful native evidence. Tutorial output: captioned local MP4 plus Markdown transcript and a linked release asset; source repo need not contain large binaries.

- [ ] Write `test/release-check.test.mjs`: missing native receipt blocks a ready claim; fixture-only Claude evidence is insufficient; stale/mismatched version receipts cannot verify a new package; a synthetic secret/private runtime file blocks packaging; an explicit unsupported surface is permitted in the matrix but cannot be advertised as working. The guard must not rewrite evidence to make itself pass.
```js
test('fixture-only evidence cannot establish native readiness', async t => {
  const result = await checkRelease({root:temporaryDirectory(t),claims:[{host:'claude',hostVersion:'fixture',platform:'win32',ready:true}],evidence:[]});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.some(message=>message.includes('native')));
});
```

- [ ] Run `node --test test/release-check.test.mjs`. Expect missing release checker.
- [ ] Implement the checker and CI for the supported Node floor/current verified runtime on Windows and Linux, using `npm ci` and `npm test` in the V2 root. Author acceptance procedures covering: ordinary website prompt in each claimed host; genuine Superpowers discovery; game answer/duplicate/interrupt/native fallback; installed architect accept/alternate/decline; harmless fixture skill installation/reload; native tool permission retained; scoped memory resume/conflict/opt-out; stopped daemon/reconnect/replay; clean uninstall. Record tested host/version/platform/package hash and pass/fail, without user transcripts or credentials. Measure model/network use: no companion-owned model requests; host usage only where exposed, otherwise label unknown. Create a captioned tutorial using the actual working build and mark any simulated fixture explicitly. Publish setup, source installation, permission/memory controls, recovery and compatibility in the README; do not give an `npx` command for an unpublished package name. Include Mermaid system, question and skill-choice flows in `docs/architecture.md` using the approved palette where rendered.
- [ ] Run `npm ci`, `npm test`, `node scripts/build-packages.mjs`, then `node scripts/release-check.mjs` against the actual package/evidence. Run native-host and browser acceptance after the final build, not just earlier fixtures. Expect no ready-claim blockers. If Claude/native access is unavailable, keep the release explicitly a preview for that host and report the unmet gate; do not declare the complete two-host user-ready goal achieved.
- [ ] Inspect the staged V2 diff, release file manifest, dependency/license inventory and privacy scan. Verify the original V1 checkout/tag is still unchanged. Commit only V2 source/docs with `git commit -m "docs: prepare verified open-source companion release"`. Check whether `JaiReyes45/construction-companion` already exists before creating the requested separate public repository; never overwrite an existing repository. Publish the reviewed V2 source and verified release artifacts under the confirmed name, without pushing V1's raw historical bundle or private receipts. Report the actual repository/release URLs and compatibility limits. Repository publication is authorized by the owner's open-source request; package registry submission and universal plugin-directory listing are separate future work.
