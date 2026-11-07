# Skill recommendations and crew choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Superpowers recommend suitable skills while users control selection, optional installation and crew assignments.

**Architecture:** Read bounded local/catalog metadata, let the existing coding agent explain recommendations, and route user choices through the correlated question broker. A separate installation intent returns to the native host for review and execution; the companion never runs the installer itself.

**Tech Stack:** Foundation store, question broker and MCP; Node.js ESM; bounded JSON/Markdown metadata readers.

**Spec:** `../specs/2026-11-07-construction-companion-v2-design.md`; types in `2026-11-07-construction-companion-contracts.md`. Depends on Plans 00–01.

## Global Constraints

- Skill recommendations come from the current host agent, using at most 20 relevant metadata entries; show at most three candidates per role. Selection, installation and evidence of actual activity remain separate states.
- Installation intents expire after 10 minutes and bind source, revision, destination, scope and expected files by digest. The native coding host reviews and performs the installation. The browser cannot execute commands. Changing any bound field creates a new intent.
- Project/task skill bindings do not grant global activation. A user's decline suppresses another recommendation for the same role and task unless the user reopens the choice.
- The existing coding host owns execution. The companion creates no model session or model API request.
- No third-party skill is installed merely because it appears in these plans or a recommendation.

## Review Focus

- A familiar skill name with a different source is not silently treated as the installed trusted package — Task 1.
- Decline, alternate and no-installed-skill paths must remain normal usable outcomes — Task 2.
- An interrupted choice cannot assign a worker to a later task — Task 2.
- A changed source, revision, destination or scope invalidates an installation request — Task 3.
- Successful download with a required host reload must not show the skill running — Task 3.

---

### Task 1: Bounded skill inventory and verified example catalog

**Files:** Create `src/skills/inventory.mjs`, `catalog/skills.json`, `catalog/README.md`, `test/skills-inventory.test.mjs`; modify `src/mcp/tools.mjs`, `src/core/service.mjs`.

**Interfaces:** Consumes `Skill`, `Capability`. Produces `readInventory({roots,catalogPath}): Promise<Skill[]>`, `skillContext({skills,goal,role,limit=20}): Skill[]`, and service `skillContext(sessionKey,{goal,role}): Promise<Skill[]>`. MCP `companion_skill_context({goal,role})` returns sanitized metadata, never file contents or executable instructions.

- [ ] Write `test/skills-inventory.test.mjs`: installed candidates sort before matching catalog candidates; cap results at 20; never execute a skill's scripts; an unconfigured filesystem root and symlink escape are refused; same display name/different source remain distinct; missing license/version is explicit `unknown`, not fabricated MIT/latest; malformed metadata does not crash other entries. Assert catalog provenance includes the canonical UI/UX Pro Max repository, pinned revision, license, checked date and prerequisite notes.
```js
test('inventory context is bounded and installed-first', () => {
  const skills = Array.from({length:30},(_,i)=>({id:'s'+i,name:'Website architect',purpose:'Website design',roles:['architect'],source:'https://example.test/s'+i,revision:'r1',license:'unknown',prerequisites:[],availability:i===29?'installed':'catalog',reloadRequired:false,provenance:i===29?'local':'verified-catalog'}));
  const result = skillContext({skills,goal:'website',role:'architect'});
  assert.equal(result.length,20);
  assert.equal(result[0].availability,'installed');
});
```

- [ ] Run `node --test test/skills-inventory.test.mjs`. Expect missing exports.
- [ ] Implement explicit root-based inventory (only host-reported or user-selected skill locations). Read bounded frontmatter/manifest metadata without executing files. Canonical identity includes source and package-relative entry. Merge catalog entries only by verified identity. Use deterministic keyword/role matching to select metadata; let the current host agent explain fit. Start the small curated catalog with UI/UX Pro Max, canonical source `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`, observed upstream manifest version `2.15.0`, revision `b7d5353e0130feb8c5574ef1251f8a1db1873ccb`, MIT. Verify its current installer layout at implementation time: scripts/data or symlinks may live outside its SKILL.md folder. A floating `npx ...@latest` command is not an approved pinned recipe. If a reproducible installation recipe cannot be verified, mark installation unavailable and provide the canonical manual source. Show already-installed local versions as observed, without silently upgrading them to the catalog version. Metadata is untrusted text, not a new instruction source.
- [ ] Run `node --test test/skills-inventory.test.mjs test/mcp.test.mjs`. Expect pass and no filesystem changes outside temporary fixtures.
- [ ] Stage task files and commit with `git commit -m "feat: expose bounded installed and catalog skill metadata"`.

### Task 2: Explained recommendations, user choices and role bindings

**Files:** Create `src/skills/choices.mjs`, `test/skill-choices.test.mjs`; modify `src/core/service.mjs`, `src/server.mjs`, `src/mcp/tools.mjs`, `skills/construction-companion/SKILL.md`.

**Interfaces:** Consumes `Origin`, `Recommendation`, `SkillChoice`, `Binding`, `ChoiceResult`, `Broker`. Produces `createSkillChoices({store,broker,inventory}): Choices` with `offer(origin,{taskId,role,candidates},options): Promise<ChoiceResult>`, `reopen(scope,{taskId,role}): void`, `bindings(scope,taskId): Binding[]`. `candidates` is `Recommendation[]` with at most three entries. Service adds `offerSkills`, `skillRecommendations(sessionKey)`, `bindings`; MCP adds `companion_choose_skill({taskId,role,candidates})` and explicit `companion_reopen_skill_choice({taskId,role})`.

Define test-local `openChoiceFixture(t)` with a real store/broker and one catalog architect; return `{choices,origin,offer,reply(answer),questionCount()}`. Its reply helper finds the broker's current question/version and calls the real reply method. Use reserved option IDs `choose-another` and `decline`; candidate IDs are prefixed `skill:` to avoid collisions.

- [ ] Write `test/skill-choices.test.mjs`: a website/architect offer contains a reason and an installed UI/UX Pro Max choice; accepting binds its observed revision with state `selected`; no skill-execution evidence appears. A catalog selection returns `request-install` and creates no binding. `choose-another` returns control to the originating host without installation, and a fresh offer can bind a different installed candidate. `decline` persists for this task/role, suppresses a repeated offer, and explicit reopen clears the suppression. Interrupted/stale choices create no binding. Changing an assignment preserves unrelated installed packages. Four candidates, missing reasons and unknown skill IDs reject.
```js
test('decline suppresses a repeat offer for the same task and role', async t => {
  const f = await openChoiceFixture(t);
  const pending = f.choices.offer(f.origin,f.offer,{});
  f.reply({optionId:'decline'});
  assert.equal((await pending).choice.action,'decline');
  assert.equal((await f.choices.offer(f.origin,f.offer,{})).choice.action,'decline');
  assert.equal(f.questionCount(),1);
  assert.deepEqual(f.choices.bindings(scope,f.offer.taskId),[]);
});
```

- [ ] Run `node --test test/skill-choices.test.mjs`. Expect absent service/choice handlers.
- [ ] Implement choices using one broker question per offer: up to three skill options, `choose-another`, and `decline` (five options maximum). Map candidate selection to `use` or `request-install` from verified availability, not user-supplied status. A new installed choice atomically replaces only that task/role binding. Recheck installed revision before binding; removal/version changes prompt a fresh review. Store display metadata by question ID for `GET /api/skills?sessionKey=`. Add no browser command-execution route. A repeated declined offer returns the stored decline without another prompt; reopening is available only on explicit user action. The entry workflow must offer installed candidates first and accept skipping without resistance; another candidate uses a new question and is never auto-selected.
- [ ] Run `node --test test/skill-choices.test.mjs test/questions.test.mjs test/mcp.test.mjs`. Expect pass for accept, alternate, decline and cancellation.
- [ ] Stage task files and commit with `git commit -m "feat: let users choose recommended crew skills"`.

### Task 3: Reviewable native-host installation intents

**Files:** Create `src/skills/intents.mjs`, `catalog/install-recipes.json`, `test/install-intents.test.mjs`; modify `src/core/service.mjs`, `src/mcp/tools.mjs`, `src/server.mjs`, `skills/construction-companion/SKILL.md`.

**Interfaces:** Consumes `Store`, `InstallIntent`, `Skill`, `Origin`, `Capability`. Produces `createIntent({store,origin,taskId,role,skill,recipe,now}): InstallIntent`, `requestIntent({store,intentId,version,digest,origin,now}): InstallIntent`, `verifyIntent({store,intentId,origin,inventory,hostReloaded,now}): InstallIntent`. `recipe` is a reviewed, pinned catalog record, not arbitrary tool input. Service exposes the same operations plus browser-safe `installation(sessionKey)`. MCP tools: `companion_install_intent({taskId,role,skillId})`, `companion_request_install({intentId,version,digest})`, `companion_verify_install({intentId,hostReloaded})`. As established in Plan 01, tools also require the signed per-turn `context`.

Define test-local `intentFixture(t)` returning `{store,origin,taskId,role,skill,recipe}` with a temporary real store and a harmless pinned local fixture recipe. No module-level mutable store is allowed. Verification reads the actual installed inventory; native failure is recorded through `failIntent({store,intentId,origin,reason}): InstallIntent` and MCP `companion_fail_install({intentId,reason})`.

- [ ] Write `test/install-intents.test.mjs`: altering source/revision/destination/scope or expected files changes the digest and supersedes prior review; a request at or after 600,000 ms expires; request before the matching review question is accepted gets `CONFLICT`; request identity cannot cross project/session/turn; request alone never executes a process or binds a worker; an installed-but-reload-required package becomes `awaiting-reload`; a native failure remains `failed`; success requires rediscovered matching identity/revision; verified installation still requires an explicit skill choice before binding. A pre-existing different version is never overwritten by default. An unsupported pinned recipe returns `UNSUPPORTED` with a manual-source explanation.
```js
test('installation requests expire at ten minutes', t => {
  const f = intentFixture(t);
  const intent = createIntent({...f,now:0});
  assert.equal(Date.parse(intent.expiresAt),600000);
  assert.throws(() => requestIntent({store:f.store,intentId:intent.id,version:intent.version,digest:intent.digest,origin:f.origin,now:600000}),{code:'EXPIRED'});
});
```

- [ ] Run `node --test test/install-intents.test.mjs`. Expect missing intent implementation.
- [ ] Implement canonical intent hashing and durable compare-and-set transitions. Bind the concrete executable/argument array into the digest as well as source/revision/destination/scope/expectedFiles. Destination paths are server-resolved and the browser gets a redacted display label through `GET /api/installation?sessionKey=`. `companion_install_intent` prepares the intent, then calls `service.reviewInstallation(origin,intentId): Promise<QuestionResult>` to show the concrete package, revision, scope, prerequisites, expected file changes and overwrite conflict in a separate discovery question. Store the review question ID/version and exact digest with the intent. `requestIntent` must find that matching answered review with option `request-install`; otherwise reject with `CONFLICT`. A timeout, decline or changed digest grants nothing. This requests installation only; return the reviewed intent to the native host, which uses its documented installer/tool under normal permissions. Prefer Claude `local` activation when supported; explain Codex user-wide package storage if unavoidable and gate project activation separately. Native-host success is not proof: rediscover, check files/provenance and require reload evidence when needed. Keep install failures/reload states visible. Do not implement shell execution or package downloading in this module. Revalidate intent freshness immediately before the host acts; expired intents require a fresh review. Follow-up MCP calls have new request IDs: require the same project/session/turn for the installation request, not the same request ID as preparation. Test this explicitly. Read-only post-reload verification may resume from a freshly authenticated session for the same project/task; it grants no execution authority and never reuses the old question waiter.
- [ ] Run `node --test test/install-intents.test.mjs test/skill-choices.test.mjs test/mcp.test.mjs`. Expect pass. In native smoke tests use a harmless locally authored fixture skill first; do not install or alter the user's UI/UX package as an automated test.
- [ ] Stage task files and commit with `git commit -m "feat: prepare verified skill installation requests for native hosts"`.
