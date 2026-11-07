# Construction Companion shared contracts

This is an interface reference for the implementation plans, not runtime code. Paths below are relative to the future V2 repository root. Functions are ESM exports; asynchronous functions return Promises. `src/contracts.mjs` owns runtime validation and these JSDoc types. Use plain JSON across HTTP/MCP; never serialize tokens or absolute local paths into browser snapshots.

```ts
type Host = 'codex' | 'claude';
type Scope = { projectId: string; host: Host; sessionId: string };
type Origin = Scope & { turnId: string; requestId: string };
type Evidence = 'declared' | 'observed' | 'unknown';
type Event = Scope & {
  schema: 1; eventId: string; sequence: number; occurredAt: string;
  adapterVersion: string; runtimeVersion: string; turnId?: string;
  type: 'session.start' | 'session.end' | 'turn.start' | 'turn.end' |
    'task.start' | 'task.verify' | 'task.complete' | 'task.fail' |
    'skill.declare' | 'actor.start' | 'actor.end' |
    'permission.wait' | 'permission.resolved' | 'history.gap';
  evidence: Evidence; actorId?: string; taskId?: string; skillId?: string;
  payload: Record<string, string | number | boolean | null>;
};
type StoredEvent = Event & { cursor: number };
type Question = Origin & {
  id: string; version: number; text: string;
  options: { id: string; label: string }[]; allowFreeText: boolean;
  status: 'open' | 'answered' | 'cancelled' | 'expired';
  expiresAt: string; answer?: { optionId?: string; text?: string };
};
type QuestionInput = Omit<Question, 'version' | 'status' | 'answer'>;
type QuestionReply = Origin & {
  id: string; version: number; answer: { optionId?: string; text?: string };
};
type QuestionResult =
  { status: 'answered'; question: Question } |
  { status: 'fallback'; reason: 'timeout' | 'unsupported' | 'disconnected' } |
  { status: 'cancelled' };
type Skill = {
  id: string; name: string; purpose: string; roles: string[];
  source: string; revision: string; license: string; prerequisites: string[];
  availability: 'installed' | 'catalog' | 'unavailable';
  reloadRequired: boolean; provenance: 'local' | 'verified-catalog';
};
type Recommendation = {
  taskId: string; role: string; skillId: string; reason: string;
};
type SkillChoice = {
  taskId: string; role: string;
  action: 'use' | 'request-install' | 'choose-another' | 'decline'; skillId?: string; reason?: string;
};
type Binding = {
  taskId: string; role: string; skillId: string; revision: string;
  state: 'selected' | 'declared' | 'observed';
};
type InstallIntent = {
  id: string; version: number; taskId: string; role: string; skillId: string;
  source: string; revision: string; destination: string;
  scope: 'project-local' | 'project-shared' | 'user';
  expectedFiles: string[]; prerequisites: string[];
  command: { executable: string; args: string[] };
  digest: string; expiresAt: string;
  status: 'pending-review' | 'requested' | 'awaiting-reload' |
    'verified' | 'failed' | 'expired' | 'superseded';
};
type MemoryWrite = {
  page: string; expectedHash: string | null; operationId: string; content: string;
};
type MemoryResult =
  { status: 'written'; hash: string } |
  { status: 'conflict'; currentHash: string } |
  { status: 'disabled' };
type Capability = {
  host: Host; hostVersion: string; platform: string;
  hooks: 'verified' | 'unverified' | 'unsupported';
  questionMode: 'verified-short' | 'verified-long' | 'native-chat';
  packageInstall: 'verified' | 'unverified'; evidencePath?: string;
};
type ChoiceResult =
  { status: 'chosen'; choice: SkillChoice } |
  { status: 'fallback'; reason: 'timeout' | 'unsupported' | 'disconnected' } |
  { status: 'cancelled' };
```

Contract policies:

- Scope values come from the authenticated host session, not arbitrary browser fields. Compare full origin and current version before accepting a reply. A browser may select only an already registered project/session.
- Native tools carry a verified per-turn `context` key when that host supports trusted hook additional context. The service combines it with the actual MCP request ID to construct the origin. Without verified correlation, questions fall back to native chat; there is no guess based on the newest chat or a presumed shared MCP session. The key is not a tool-execution permission and is never logged. All injected `now()` clocks return Unix epoch milliseconds.
- Validate ISO timestamps, nonempty bounded IDs, nonnegative source sequence and `schema: 1`. Event IDs deduplicate within a scope; equal IDs with unequal canonical bodies are conflicts. Source sequence is diagnostic; the durable cursor defines replay order. Never silently discard late events based on source order.
- Payload is an allowlist per event type: lifecycle labels, duration, success/result flags and host-native identifiers. Reject raw prompt/tool input/output, environment, credentials, reasoning and arbitrary nested transcript objects. Unknown hook types produce diagnostics, not fabricated lifecycle events.
- `task.complete` changes a task only with observed success evidence. If the host cannot establish success, project it as unknown. A skill declaration never upgrades itself to observed skill execution just because a generic tool ran.
- Public API errors use `{error: {code, message}}` with codes `INVALID`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `EXPIRED`, `UNSUPPORTED`, `LIMIT`, `MEMORY_DISABLED`. Map them to 400/401/404/409/410/422/413/403 respectively. A lost question waiter has a fallback result; it is not an accepted answer.
- A changed candidate is represented by a fresh `SkillChoice`. `choose-another` returns control to the originating host, which offers another installed or verified candidate in a fresh question; it does not silently install a substitute. Declining is persisted for this task/role; reopening is an explicit user action.
- Installation status is not a permission grant. A requested intent is returned to the originating native host, which applies its normal reviews and permissions. Verification rediscovers installed metadata; a claimed tool-success string is insufficient.
- Preserve the distinction between workflow, role, skill, native actor and task in code and UI. There is no worker-owned model, independent mind or continuous reasoning loop.

The plans name additional module-local return shapes where useful; these shared types must remain consistent across modules. Avoid adding a general workflow engine, cloud account system, plugin marketplace crawler or vector database.
