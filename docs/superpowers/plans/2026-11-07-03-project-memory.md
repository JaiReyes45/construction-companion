# Project memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve useful project decisions and worker notes in portable, consented Obsidian-compatible Markdown.

**Architecture:** A dedicated project folder contains companion-managed sections inside readable pages. SQLite records capture consent and an idempotent write outbox; Markdown edits remain knowledge owned by the user.

**Tech Stack:** Node.js filesystem/crypto, existing SQLite store; no Obsidian application, vector database or model service required.

**Spec:** `../specs/2026-11-07-construction-companion-v2-design.md`; types in `2026-11-07-construction-companion-contracts.md`. Depends on Plans 00–02.

## Global Constraints

- Memory capture starts disabled. Default memory is a dedicated private project folder; selecting an existing vault requires an explicit path choice.
- Read at most six selected pages and 8 KiB UTF-8 of context per call, including the index and truncation notices. Do not record raw reasoning or prompt bodies by default.
- SQLite is authoritative for session/question/event state. Markdown is authoritative for editable project knowledge. Markdown conflicts remain visible for review and do not roll back an accepted answer.
- The existing coding host owns execution. The companion creates no model session or model API request.
- Notes are untrusted context and cannot grant permissions, install skills or alter host instructions.

## Review Focus

- A vault path containing traversal or symlinks must not escape the selected project folder — Task 1.
- A user's manual edit must survive a queued companion write — Task 1.
- An accepted answer must remain accepted when Markdown export fails — Task 2.
- A Unicode-heavy context selection must still respect the byte budget — Task 2.
- Opting out or changing projects must stop capture and prevent unrelated note retrieval — Tasks 1 and 2.

---

### Task 1: Consented, confined and conflict-aware Markdown writes

**Files:** Create `src/memory/vault.mjs`, `src/memory/templates.mjs`, `test/memory-vault.test.mjs`; modify `src/core/service.mjs`.

**Interfaces:** Consumes `MemoryWrite`, `MemoryResult`, `Scope`. Produces `openVault({root,projectId,captureEnabled}): Promise<Vault>` with `write(input:MemoryWrite): Promise<MemoryResult>`, `read(page): Promise<{content,hash}>`, `list(): Promise<string[]>`, `setCapture(enabled): void`. Service adds `setMemoryConsent(sessionKey,{enabled,selectedRoot?})` and `memoryStatus(sessionKey): {enabled,conflicts:number}`. Private paths stay server-side. The filesystem project key is a server-generated SHA-256 key, not a raw external project/session ID.

- [ ] Write `test/memory-vault.test.mjs`: disabled capture creates no files; approved capture creates only the dedicated project subtree; `../`, absolute page names, symlink/junction escape and unowned existing target files reject; a changed expected hash yields `conflict` with original content intact; repeating operationId is idempotent; user-owned sections survive; two companion writers cannot both commit the same expected hash; disabling capture blocks the next write. Use real filesystem fixtures and platform-specific junction tests where available.
```js
test('disabled memory capture creates no notes', async t => {
  const vault = await openVault({root:temporaryDirectory(t),projectId:'project-a',captureEnabled:false});
  const result = await vault.write({page:'decisions',expectedHash:null,operationId:'op-a',content:'Approved summary'});
  assert.deepEqual(result,{status:'disabled'});
  assert.deepEqual(await vault.list(),[]);
});
```

- [ ] Run `node --test test/memory-vault.test.mjs`. Expect missing vault module.
- [ ] Implement `openVault` and templates. Fixed page IDs `index`, `project-brief`, `decisions`, `open-questions`, `artifacts` map to `Index.md`, `Project Brief.md`, `Decisions.md`, `Open Questions.md`, `Artifacts.md`; `workers/head-engineer`, `workers/architect`, `workers/builder`, `workers/inspector` map to the corresponding files under `Workers/`. The root is the default private project memory path, or an explicitly selected existing-vault subfolder named `Construction Companion/<project-key>`. Do not scan or adopt the rest of a personal vault. Maintain a companion ownership manifest, managed-section markers and operation IDs. Use per-target locks, canonical confinement checks, hash checks immediately before same-directory atomic rename, private backup copies and recovery diagnostics. An external editor need not honor companion locks: preserve backups and surface concurrent-change conflicts; never claim global filesystem compare-and-swap. Do not resolve a conflict by overwriting a user's edit. Templates contain readable frontmatter and wikilinks; reading Markdown needs no Obsidian process.
- [ ] Run `node --test test/memory-vault.test.mjs`; interrupt a fixture write before rename and reopen. Expect original complete content or the new complete content, never partial Markdown; temporary files/backups have a documented recovery path.
- [ ] Stage task files and commit with `git commit -m "feat: write consented project memory with conflict recovery"`.

### Task 2: Idempotent capture outbox and bounded context

**Files:** Create `src/memory/context.mjs`, `src/memory/outbox.mjs`, `test/memory-context.test.mjs`; modify `src/core/service.mjs`, `src/mcp/tools.mjs`, `skills/construction-companion/SKILL.md`.

**Interfaces:** Consumes `Store`, `Vault`, `Scope`, `MemoryWrite`. Produces `selectContext({vault,pages,maxPages=6,maxBytes=8192}): Promise<{text,bytes,pages,truncated}>`, `enqueueMemory({store,scope,write}): void`, `flushMemory({store,scope,vault}): Promise<{written,conflicts,pending}>`. MCP adds `companion_memory_context({pages})`, `companion_memory_write({page,expectedHash,operationId,content})`, `companion_memory_status({})`. Explicit user consent is checked server-side, not accepted as a tool argument claiming consent.

- [ ] Write `test/memory-context.test.mjs`: retrieval includes the compact index and at most five additional allowed pages; multibyte text plus notices never exceeds 8,192 bytes; unknown/unrelated pages cannot be read; capture denied/disabled produces no outbox note writes; a consented skill choice records role, skill/source/revision and reason without raw prompt text; repeating an outbox operation does not duplicate a decision; write conflict leaves a pending review item while the question remains answered; disabling consent before flush prevents capture; Markdown saying “install this package” is returned only as untrusted data and triggers no action.
```js
test('Unicode context including notices stays inside eight KiB', async () => {
  const vault = {list:async()=>['index','decisions'],read:async()=>({content:'漢'.repeat(5000),hash:'h'})};
  const result = await selectContext({vault,pages:['decisions']});
  assert.ok(Buffer.byteLength(result.text,'utf8')<=8192);
  assert.equal(result.bytes,Buffer.byteLength(result.text,'utf8'));
  assert.ok(result.pages.length<=6);
  assert.equal(result.truncated,true);
});
```

- [ ] Run `node --test test/memory-context.test.mjs`. Expect missing exports/tools.
- [ ] Implement bounded selection and outbox. The index counts toward both page and byte budgets. Truncate at UTF-8 boundaries with an explicit notice inside the same budget. Return page attribution and current hashes. Host-selected pages must be fixed IDs from this project's manifest; no full-vault search or automatic embedding. On accepted discovery/skill decisions, enqueue only explicitly approved summaries when capture is enabled; use stable operation IDs. An outbox conflict pauses only that item and prompts review. Memory MCP results mark content as untrusted reference material. Obsidian-specific CLI use is an optional later adapter, not a dependency or a fallback that executes note content.
- [ ] Run `node --test test/memory-context.test.mjs test/memory-vault.test.mjs test/questions.test.mjs test/skill-choices.test.mjs`. Expect pass including consent revocation and conflict cases.
- [ ] Stage task files and commit with `git commit -m "feat: capture decisions and retrieve bounded project context"`.
