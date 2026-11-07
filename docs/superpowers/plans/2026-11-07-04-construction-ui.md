# Construction site interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make questions, crew choices and real coding progress understandable through a cute, accessible construction site.

**Architecture:** A deterministic event projection drives a small canvas scene beside ordinary HTML controls. The scene decorates evidence; readable cards and native-host links carry the interaction.

**Tech Stack:** Vanilla browser ESM, Canvas 2D, HTML/CSS, existing authenticated local service; original CC0 V1 sprite atlas.

**Spec:** `../specs/2026-11-07-construction-companion-v2-design.md`; types in `2026-11-07-construction-companion-contracts.md`. Depends on Plans 00–03.

## Global Constraints

- The existing coding host owns execution. The companion creates no model session or model API request.
- Skill recommendations come from the current host agent, using at most 20 relevant metadata entries; show at most three candidates per role. Selection, installation and evidence of actual activity remain separate states.
- Project/task skill bindings do not grant global activation. A user's decline suppresses another recommendation for the same role and task unless the user reopens the choice.
- Native permission requests cannot be approved through a discovery question or game control.
- Use the approved warm-paper, dark-ink and construction-orange palette, original CC0 artwork, keyboard controls, readable text alternatives and reduced motion.

## Review Focus

- A selected/decorative worker must not imply the skill or a separate agent is executing — Task 1.
- Reconnection and replay must not duplicate workers or complete failed tasks — Task 1.
- Stale question cards and installation reload states must be explicit — Task 2.
- Untrusted skill names/note content must display as text, without script execution — Task 2.
- Narrow screens, keyboard-only navigation and reduced motion must retain the complete workflow — Task 3.

---

### Task 1: Deterministic evidence projection

**Files:** Create `public/projection.mjs`, `test/projection.test.mjs`; modify `src/core/service.mjs`, `src/server.mjs`.

**Interfaces:** Consumes `StoredEvent`, `Binding`, `Question`. Produces `emptyScene(): Scene`, `applyEvent(scene,event): Scene`, `projectScene(events): Scene`; `Scene` is `{cursor,tasks,actors,skills,permissions,historyGap}` with maps keyed by authenticated task/actor/skill IDs. Add `service.scene(sessionKey): Scene` and `GET /api/scene?sessionKey=`. Bindings/questions/installation states are separate snapshot fields, not fake execution events.

- [ ] Write `test/projection.test.mjs`: replaying the same cursor is idempotent; incremental replay equals full replay; a selected or declared skill never becomes observed from an unrelated tool event; observed native actor IDs remain distinct; failed/cancelled tasks never increment completed construction; a late `task.start` for a terminal task cannot resurrect it; a new attempt requires a new task ID; unresolved permission waits remain separate from discovery questions; a history gap makes incomplete evidence visible. Assert unknown result evidence cannot complete a task.
```js
test('replay is idempotent and unknown success cannot complete a task', () => {
  const e = {...event({type:'task.complete',taskId:'task-a',evidence:'unknown'}),cursor:1};
  const once = projectScene([e]);
  assert.deepEqual(applyEvent(once,e),once);
  assert.notEqual(once.tasks['task-a']?.status,'completed');
});
```

- [ ] Run `node --test test/projection.test.mjs`. Expect missing projection module.
- [ ] Implement pure projection in a browser-compatible module with no timers, network, filesystem or model calls. Use durable cursor order, ignore replayed cursors and preserve terminal task states. Do not infer an actor or skill from generic activity. Derive scene construction only from observed task success, using bounded visual stages and a count label rather than a fabricated percentage. Add a sanitized scene snapshot endpoint; cache checkpoints internally only if needed, with full replay remaining the reference behavior.
- [ ] Run `node --test test/projection.test.mjs test/store.test.mjs test/server.test.mjs`. Expect pass and identical replay snapshots.
- [ ] Stage task files and commit with `git commit -m "feat: project truthful crew and construction states"`.

### Task 2: Question, skill, memory and recovery controls

**Files:** Create `public/index.html`, `public/styles.css`, `public/app.mjs`, `public/api.mjs`, `public/view-model.mjs`, `test/view-model.test.mjs`; modify `src/server.mjs`.

**Interfaces:** Consumes scene/question/skill/installation/memory service snapshots. Produces `makeViewModel({scene,question,recommendations,installation,memory,connected}): ViewModel`, where `ViewModel` contains `{statusText:string,actions:{id:string,label:string,enabled:boolean}[]}` plus sanitized card data; `createApi({origin,token,fetchImpl}): Api` with `load(sessionKey)`, `answer(sessionKey,reply)`, `setMemoryConsent(sessionKey,input)`. The browser never invokes a process. `load` fetches bounded existing routes; do not expose full store state or arbitrary paths.

- [ ] Write `test/view-model.test.mjs`: permission waits offer only a native-host return instruction; a pending discovery card exposes reply options and free text; answered/cancelled/stale versions disable submission; a catalog skill exposes installation review rather than a running worker; awaiting-reload stays distinct from available; decline is a normal choice; offline disables submits and shows reconnect; synthetic HTML in skill names is plain data. Assert view-model actions contain no `execute-command`, native `approve`, or arbitrary URL action. Test API authentication and 409 handling with an injected fetch.
```js
test('native permissions have no browser approve action', () => {
  const scene = projectScene([{...event({type:'permission.wait',payload:{label:'Run tests'}}),cursor:1}]);
  const vm = makeViewModel({scene,question:null,recommendations:[],installation:null,memory:{enabled:false,conflicts:0},connected:true});
  assert.equal(vm.actions.some(a=>a.id==='approve'),false);
  assert.equal(vm.actions.some(a=>a.id==='execute-command'),false);
  assert.ok(vm.statusText.includes('native'));
});
```

- [ ] Run `node --test test/view-model.test.mjs`. Expect missing UI modules.
- [ ] Implement the HTML interface with a connection/token screen, project/session selector, head-engineer question card, crew/skill cards, installation review, current tasks/evidence, memory settings and history-gap/offline notices. Use real form controls and `textContent`, never untrusted `innerHTML`. Show purpose, source, observed version/revision, license and prerequisites on skill cards. “Choose another” returns to the native host for a fresh choice; “Continue without” submits decline. Installation cards show requested/failed/reload states, not an approve-command button. Discovery replies include the shown version and cannot be optimistically marked accepted until acknowledged. Add UI-token routes `GET /api/memory?sessionKey=` and `POST /api/memory/consent`; vault path choice is a separate explicit onboarding field with server confinement checks. The UI token is in memory only and cleared on disconnect. Poll bounded snapshots while visible; pause polling when hidden and back off on errors. A 409 replaces stale content and asks the user to review the current card.
- [ ] Run `node --test test/view-model.test.mjs test/server.test.mjs test/questions.test.mjs test/install-intents.test.mjs`. Expect pass. Inspect the real browser with the browser skill: submit a fixture answer, encounter a stale reply, decline a recommendation and reconnect. Record results without credentials in screenshots.
- [ ] Stage task files and commit with `git commit -m "feat: add game-side questions and user-controlled crew choices"`.

### Task 3: Pixel scene and accessible complete journey

**Files:** Create `public/site.mjs`, `public/assets/construction/sprites.png`, `public/assets/construction/sprites.json`, `public/assets/construction/LICENSE.txt`, `test/scene-budget.test.mjs`, `docs/accessibility-checks.md`; modify `public/app.mjs`, `public/styles.css`.

**Interfaces:** Consumes `Scene` and the copied sprite atlas `{width:100,height:28,frameWidth:20,frameHeight:28,roles:['engineer','architect','foreman','builder','inspector']}`. Produces `mountSite({canvas,scene,reducedMotion,requestFrame,cancelFrame}): {update(scene),destroy()}`. The animation module has no API client or model interface.

Define test-local `createCanvasFixture(): {canvas}` using a recorded no-op 2D context implementing the methods the renderer uses; it must not stub the renderer or frame scheduler. Non-reduced-motion mount schedules one initial frame even for the empty scene.

- [ ] Write `test/scene-budget.test.mjs` with injected canvas/frame functions: destroy cancels pending frames; reduced motion paints only when state changes; hidden view pauses animation; drawing never calls fetch or a model service; two identical scenes render identical construction stages. Test the module boundary rather than comparing every decorative pixel.
```js
test('destroy cancels the pending animation frame', () => {
  const f = createCanvasFixture();
  const cancelled = [];
  const site = mountSite({canvas:f.canvas,scene:emptyScene(),reducedMotion:false,requestFrame:()=>7,cancelFrame:id=>cancelled.push(id)});
  site.destroy();
  assert.deepEqual(cancelled,[7]);
});
```

- [ ] Run `node --test test/scene-budget.test.mjs`. Expect missing scene module.
- [ ] Copy only the original three sprite/credit files from the preserved V1 source. Implement crisp nearest-neighbor sprites, short local walking/tool loops, engineer speech indicator and task-driven construction stages. Use CSS tokens paper `#F5F0E6`, ink `#24211D`, orange `#C35A21`, with contrast checked for the actual text sizes; use ink text where orange text fails. All state and actions remain in readable HTML beside the decorative canvas. Support 320 px width, 200% zoom, visible keyboard focus, screen-reader status announcements and `prefers-reduced-motion`. No continuously moving animation while disconnected, hidden or paused. A selected architect can stand ready with a `Selected` badge; it begins work only with appropriate evidence.
- [ ] Run `node --test test/scene-budget.test.mjs test/view-model.test.mjs test/projection.test.mjs`. Then complete the documented browser journey at desktop and 320 px: keyboard connect, answer, choose alternate, decline, inspect installation reload, toggle memory, interrupt/disconnect/reconnect and return to native permission prompt. Verify reduced motion and inspect browser network traffic: only loopback/static requests, zero model requests. Capture the actual tested browser/version and any unresolved issues; unresolved accessibility/workflow failures block user-ready release.
- [ ] Stage task files and commit with `git commit -m "feat: animate an accessible evidence-driven construction site"`.
