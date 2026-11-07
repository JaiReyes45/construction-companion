# Host bridge and head engineer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect real host activity and Superpowers questions to the companion without taking execution authority from the host.

**Architecture:** Host-specific metadata normalizers feed a bounded local spool. A stdio MCP server exposes explicit companion tools, including a versioned question wait with native-chat fallback.

**Tech Stack:** Foundation modules; @modelcontextprotocol/sdk 1.32.2; zod 4.6.7; Node.js >=22.13.0.

**Spec:** `../specs/2026-11-07-construction-companion-v2-design.md`; types in `2026-11-07-construction-companion-contracts.md`. Depends on Plan 00.

## Global Constraints

- The existing coding host owns execution. The companion creates no model session or model API request.
- One active discovery question per session. Text is limited to 4,000 characters, choices to six, and replies to 16 KiB UTF-8. A question is not a native execution permission. A fresh question version is required after editing or replacement.
- Question wait defaults to 45 seconds with a single native-chat fallback on timeout. A maximum of 600 seconds is available only for a host/version with a recorded successful long-wait probe; no automatic wait/retry loop. Cancellation and disconnect end the pending wait explicitly.
- Event payload limit is 16 KiB encoded UTF-8. HTTP request limit is 64 KiB. Return at most 100 events and at most 768 KiB per replay page. The local metadata spool is capped at 5 MiB; overflow produces an explicit history-gap marker.
- Native permissions remain native; unsupported host features stay explicitly unsupported or unverified.

## Review Focus

- A stopped daemon must not block the coding session — Task 1.
- Hook payloads and shell metacharacters must never become commands or prompt logs — Task 1.
- Duplicate replies or replies from another turn must not reach the waiting request — Task 2.
- Interrupts, restart and long idle waits must end explicitly rather than silently submitting an answer — Tasks 2 and 3.
- Missing Superpowers or an unsupported host must produce actionable fallback, not impersonated skill execution — Task 3.

---

### Task 1: Host normalization and nonblocking spool

**Files:** Create `src/host/normalize.mjs`, `src/host/spool.mjs`, `src/host/hook.mjs`, `src/host/context.mjs`, `test/hooks.test.mjs`, `test/fixtures/hosts/codex.json`, `test/fixtures/hosts/claude.json`.

**Interfaces:** Consumes `Event`, `validateEvent`. Produces `normalizeHook(host,raw,context): Event|null`, `appendSpool({directory,event,maxBytes=5242880}): {written,gap}`, `drainSpool({directory,send}): Promise<{sent,remaining}>`, and `runHook({host,input,context,spoolDirectory}): {exitCode:0,additionalContext?:string}`. `context` supplies authenticated scope, adapter/runtime versions and a stable native-event identity mapping. `send(event)` returns the ingest acknowledgement. Context helpers: `signContext({scope,turnId,expiresAt},secret): string` and `verifyContext(token,secret,now): {scope,turnId,expiresAt}`.

- [ ] Write `test/hooks.test.mjs`: normalize only the measured host event fields from Plan 00; unknown types return null; prompt/tool arguments containing a synthetic secret never occur in spool bytes; native subagent identity remains distinct from a declared skill; replaying a spool entry retains its event ID; daemon-offline entries survive; overflowing 5 MiB emits a bounded history-gap record; two concurrent hook writers do not corrupt each other's entries. Measure hook latency in a separate benchmark, not a flaky tight CI time assertion.
```js
test('context tampering and expiry cannot change the target chat', () => {
  const secret = Buffer.alloc(32,7);
  const key = signContext({scope,turnId:'turn-a',expiresAt:3600000},secret);
  assert.equal(verifyContext(key,secret,0).scope.sessionId,scope.sessionId);
  assert.throws(() => verifyContext(key+'x',secret,0),{code:'UNAUTHORIZED'});
  assert.throws(() => verifyContext(key,secret,3600000),{code:'EXPIRED'});
});
```

- [ ] Run `node --test test/hooks.test.mjs`. Expect missing module failure.
- [ ] Implement normalizers from sanitized real protocol shapes, not assumed shared schemas. Write one atomic file per spool entry; coordinate total-size accounting and overflow markers with a short bounded lock. Hook success means metadata was queued or explicitly dropped, not that the UI rendered it. Return host-required success output immediately after bounded local I/O; never await HTTP or spawn a background shell from the hook. A separate daemon drain retries acknowledged IDs idempotently and deletes only acknowledged files. Use strict allowlists and per-entry limits. When a measured host supports trusted per-turn additional context, return an HMAC-signed, one-hour context key for its actual project/session/turn. Do not persist that key in scene/history/logs. Test tampering, expiry and wrong-project rejection. If the host cannot supply/route this context reliably, mark game questions unsupported and use native chat; never guess the most recent active chat. Benchmark toward a 50 ms local append target; publish measured percentiles and limitations rather than claiming a cross-platform guarantee.
- [ ] Run `node --test test/hooks.test.mjs test/store.test.mjs`; run the daemon-offline hook benchmark with at least 100 fixtures. Expect pass and a bounded, redacted receipt. A slow/unusable hook path blocks claiming support for that platform.
- [ ] Stage task files and commit with `git commit -m "feat: normalize host metadata through a bounded spool"`.

### Task 2: Correlated question broker

**Files:** Create `src/questions.mjs`, `test/questions.test.mjs`; modify `src/core/service.mjs`, `src/server.mjs`.

**Interfaces:** Consumes `Origin`, `QuestionInput`, `QuestionReply`, `QuestionResult`, `Store`. Produces `createQuestionBroker({store,now}): Broker`, with `ask(input,{signal,timeoutMs}): Promise<QuestionResult>`, `reply(reply): Question`, `cancel(origin): void`, `recover(): void`, `get(scope): Question|null`. Add service methods `ask`, `answer(sessionKey,{id,version,answer})`, `cancel`, and `question(sessionKey)`. The service resolves the stored origin itself for browser answers.

- [ ] Write `test/questions.test.mjs`: one valid reply resolves exactly one waiter; replay gets `CONFLICT`; mismatched project/session/turn/request and stale versions reject; a second open question conflicts; invalid option IDs and 16,385-byte replies reject; timeout resolves fallback once; AbortSignal resolves cancelled; disconnect resolves disconnected fallback; restart marks old open calls cancelled; answering after cancellation gets `CONFLICT`; a transaction failure leaves neither an answer nor a partial active-question pointer. Use an injected clock and real store; do not sleep for 45 seconds in unit tests.
```js
test('one answer resolves only one versioned question', async t => {
  const broker = createQuestionBroker({store:openTemporaryStore(t),now:()=>0});
  const origin = {...scope,turnId:'turn-a',requestId:'request-a'};
  const q = {...origin,id:'q-a',text:'Which audience?',options:[{id:'a',label:'Customers'}],allowFreeText:false,expiresAt:new Date(45000).toISOString()};
  const pending = broker.ask(q,{timeoutMs:45000});
  const reply = {...origin,id:'q-a',version:1,answer:{optionId:'a'}};
  broker.reply(reply);
  assert.equal((await pending).status,'answered');
  assert.throws(() => broker.reply(reply),{code:'CONFLICT'});
});
```

- [ ] Run `node --test test/questions.test.mjs`. Expect missing broker/routes.
- [ ] Implement broker state in the scoped store transaction: question record, version and single active pointer change atomically. Keep waiting promises only in memory. Use explicit cancellation and a one-shot timer; recovery cancels orphaned open requests. Set a bounded tombstone for duplicate/stale reply diagnostics. Add UI-authenticated `GET /api/question?sessionKey=` and `POST /api/question/answer` with `{sessionKey,id,version,answer}`. The browser cannot supply or overwrite an origin. Returning to native chat never accepts a fabricated answer. Native permission events have no broker answer route.
- [ ] Run `node --test test/questions.test.mjs test/server.test.mjs`. Expect pass; extend HTTP tests to cover stale-answer 409 and forged-origin fields 400.
- [ ] Stage task files and commit with `git commit -m "feat: correlate game questions with native host requests"`.

### Task 3: MCP tools and Superpowers entry workflow

**Files:** Create `src/mcp/server.mjs`, `src/mcp/tools.mjs`, `src/mcp/client.mjs`, `skills/construction-companion/SKILL.md`, `test/mcp.test.mjs`, `test/fixtures/mcp-harness.mjs`; modify `package.json`, `package-lock.json`, `src/compat.mjs`, `src/server.mjs`.

**Interfaces:** Consumes `Service`, `Capability`, `QuestionInput`. Produces `createHostClient({endpoint,token,fetchImpl}): HostClient`, `startMcp({client,capability,transport}): Promise<{close}>` and `registerTools(server,{client,capability}): void`. `HostClient.call(method,input,{context,requestId,signal}): Promise<unknown>` uses private `POST /host/rpc`, authenticated with the ingest credential plus verified context. The service constructs `Origin` from signed host context plus the actual MCP request ID; it is not a caller-selected chat ID. Initially expose `companion_status({})`, `companion_report({context,event})`, `companion_ask({context,id,text,options,allowFreeText})`. All subsequent session tools require this `context` field as well; omit it only in public capability/status inspection. Later plans register skill and memory tools in this same module.

Test-only `openMcpFixture(t,capabilityOverrides)` in `test/fixtures/mcp-harness.mjs` creates an in-memory SDK client/server connected to a real temporary service. It returns `{context,call(name,input),questionWaitCount()}`; `call` unwraps structured tool results, and the counter instruments real broker asks without replacing their behavior.

- [ ] Write `test/mcp.test.mjs` using the SDK's in-memory transport: a tool answer reaches the original request; native-chat-only capability returns fallback without waiting; cancellation propagates to the broker and a closed RPC; an unknown/tampered/expired context is rejected; two active native chats cannot consume each other's answer; `companion_report` cannot change scope or accept raw reasoning; stdout contains only protocol frames. Assert `companion_ask` uses 45,000 ms unless a measured long-wait capability authorizes the longer bound, and never retries itself.
```js
test('unsupported game questions immediately use native chat', async t => {
  const f = await openMcpFixture(t,{questionMode:'native-chat'});
  const result = await f.call('companion_ask',{context:f.context,id:'q-a',text:'Audience?',options:[],allowFreeText:true});
  assert.deepEqual(result,{status:'fallback',reason:'unsupported'});
  assert.equal(f.questionWaitCount(),0);
});
```

- [ ] Run `node --test test/mcp.test.mjs`. Expect absent exports/dependencies.
- [ ] Pin and lock the SDK and zod versions above. Implement stdio MCP with stderr diagnostics and SDK cancellation. The MCP process connects to the authenticated singleton local service; do not open an independent conflicting database writer per tool call. Add the private allowlisted `/host/rpc` dispatcher, verify context and active turn before routing, enforce the same body limits, and propagate AbortSignal/disconnect to pending questions. Browser credentials cannot use this endpoint. Native host interruption marks the signed turn inactive and cancels its question. Register input schemas and use structured, bounded results. Write the entry skill using the skill-writing instructions before authoring it: detect an available genuine Superpowers workflow, invoke it through the host's documented skill mechanism, use the trusted hook's context key, send companion questions only when supported, return fallback questions to native chat once, and describe observed versus declared crew activity. If Superpowers is missing, provide its verified setup source and continue only through an explicitly chosen normal-host path. Do not copy upstream prompts or claim the companion supplies Superpowers. Include the approved skill recommendation flow from Plan 02 and memory consent from Plan 03 as explicit tool calls, never hidden autonomous loops.
- [ ] Run `node --test test/mcp.test.mjs test/questions.test.mjs`, then run one harmless native Codex question round-trip. Record actual transport timeout behavior; probe a reply after 90 seconds before enabling `verified-long`. Repeat in Claude when available. A fixture pass with no native receipt leaves that capability unverified; do not enable it in release metadata.
- [ ] Stage task files and commit with `git commit -m "feat: expose companion tools and head engineer workflow"`.
