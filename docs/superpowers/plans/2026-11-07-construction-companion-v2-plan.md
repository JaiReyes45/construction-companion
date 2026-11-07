# Construction Companion V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an open-source construction companion beside Codex and Claude Code, with Superpowers as head engineer, user-chosen crew skills and project-scoped Markdown memory.

**Architecture:** The user's existing coding agent owns reasoning, tools and native permissions. A local authenticated core receives metadata through host adapters and MCP, serves the pixel site, correlates answers and stores consented project knowledge. No independent worker model is created for animation or roleplay.

**Tech Stack:** Node.js >=22.13.0, ESM/JSDoc, built-in HTTP/SQLite/test; MCP SDK 1.32.2 and zod 4.6.7 pinned during implementation; vanilla HTML/CSS/Canvas; portable Markdown; host-specific plugin packages.

**Spec:** [Approved design](../specs/2026-11-07-construction-companion-v2-design.md), including the owner's approved skill-recommendation amendment and proposed engineering defaults. Read [shared contracts](2026-11-07-construction-companion-contracts.md) before a subsystem plan.

## Global Constraints

- The existing coding host owns execution. The companion creates no model session or model API request.
- V2 lives in its own construction-companion repository. V1 source, services, history and public prototype tags are preserved.
- Project/task skill bindings do not grant global activation. A user's decline suppresses another recommendation for the same role and task unless the user reopens the choice.
- Memory capture starts disabled. Default memory is a dedicated private project folder; selecting an existing vault requires an explicit path choice.
- User-ready compatibility requires native-host evidence on every advertised host/version/platform. Fixture tests alone do not qualify a host. Unsupported or unverified capabilities are labelled explicitly.

## Review Focus

- Selected skills are not proof of execution — Plan 04 Task 1 and Plan 02 Task 2.
- Installation choice must not bypass native permissions — Plan 02 Task 3 and Plan 04 Task 2.
- Wrong-session, stale and interrupted answers must not be delivered — Plan 01 Task 2.
- Memory edits, opt-out and project boundaries must be preserved — Plan 03 Tasks 1–2.
- Clean install/uninstall and actual host support must be demonstrated — Plan 05 Tasks 2–3.

---

## What the website example will do

1. You prompt your existing coding agent: “I want to build a website.”
2. Superpowers, as the head engineer, asks about the site and recommends an architect skill with a reason.
3. The game shows UI/UX Pro Max, its source/version/license, whether it is already installed, and alternatives. You can use it, review an optional installation, choose another skill, or continue without one.
4. Choosing a catalog skill opens a separate concrete installation review. Codex/Claude performs any approved installation through its own tools and permission system. A required reload remains visible.
5. The architect appears as selected. It is shown working only when declared/observed activity supports that label. Decisions can be saved in this project's memory if you enable capture.

An ordinary skill is not a separate autonomous agent. If the host actually creates a native subagent, the site can show that actor with its real identity. Changing architect assignments does not uninstall your other skills.

## Delivery and use

The primary delivery is a **public GitHub source repository plus separate Codex/Claude Code plugin packages**. Users install the package appropriate to their host, review hooks, run doctor, select a project and open a **local browser construction dashboard**. They continue prompting in their normal coding environment. They can edit optional memory in Obsidian or any Markdown editor.

This release does not require a public hosted dashboard, a desktop installer, HubSpot, Docker, or a new model subscription. Existing coding-host/model usage may still cost money. Static animation and routing add no model calls. A future VS Code extension or desktop wrapper can reuse the core, but is outside this first companion release.

## Execution order and file boundaries

| Order | Plan | Independently testable result |
|---|---|---|
| 00 | [Foundation](2026-11-07-00-foundation.md) | Capability receipts, scoped durable events and authenticated loopback service |
| 01 | [Host bridge and questions](2026-11-07-01-host-and-questions.md) | Bounded metadata hooks, correlated game answers and head-engineer MCP workflow |
| 02 | [Skill choices](2026-11-07-02-skill-choices.md) | Installed-first recommendations, accept/alternate/decline and native-host installation intents |
| 03 | [Project memory](2026-11-07-03-project-memory.md) | Consented Markdown writes, conflicts/outbox and bounded context |
| 04 | [Construction interface](2026-11-07-04-construction-ui.md) | Truthful replay, accessible questions/choices and original pixel animations |
| 05 | [Distribution and release](2026-11-07-05-distribution-and-release.md) | Reversible installers, doctor, native acceptance, tutorial and public source release |

There are 17 implementation tasks. Run them in order in the separate V2 repository. Each task has a meaningful failing test, exact exports and files, a passing check and a narrow commit. The plans intentionally exclude a new agent scheduler, marketplace crawler, full-vault ingestion, CRM rewrite and hidden model service.

Top-level source layout: `src/core/` for state/service; `src/host/` and `src/mcp/` for integration; `src/skills/` for recommendations/intents; `src/memory/` for knowledge; `public/` for scene/UI; `packaging/` and `bin/` for host distribution. Tests use temporary data and isolated host homes. Runtime credentials and notes are outside source by default.

## Dependencies and release evidence

- Current local Codex CLI version: 0.155.1. Actual probe/acceptance evidence is required again at implementation and release.
- Claude Code is not currently on PATH. Its native round-trip/install/reload test is an open release gate, not a presumed pass.
- The canonical UI/UX Pro Max package was inspected as an example; this planning change does not install it or grant future installation permission.
- Superpowers remains an external genuine workflow dependency; no upstream prompt bundle is silently relabelled or copied.
- The Facebook reference was partially accessible: public caption and an Obsidian setup frame. Full footage/audio was unavailable behind sign-in. Implementation follows your approved design rather than a claimed reconstruction of unseen code.

Verified documentation used for the plan: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude plugins](https://code.claude.com/docs/en/plugins), [Claude installation scopes/reload](https://code.claude.com/docs/en/discover-plugins), [Claude hooks](https://code.claude.com/docs/en/hooks), [UI/UX Pro Max canonical source](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). Check these again before generating host configuration; upstream support can change.

## Design coverage and self-review

| Approved requirement | Implementation owner and evidence |
|---|---|
| Keep V1; separate open source | Foundation Task 1; release Task 3; preserved [V1 verified archive](https://github.com/JaiReyes45/AI-Automation-BasicProjects/tree/construction-crm-v1-prototype-verified/prototypes/construction-crm-v1) |
| Existing host + Superpowers head engineer | Host Task 3; native ordinary-prompt acceptance |
| Recommend appropriate skills; user can refuse/substitute | Skill Tasks 1–3; required website choice scenarios |
| Workers represent roles/skills with honest activity | UI Task 1; native actor and declared/observed tests |
| Correlated questions + native fallback | Host Tasks 2–3; interrupt, timeout and duplicate tests |
| Native tool permissions | Skill Task 3; UI Task 2; native permission acceptance |
| Project memory/Obsidian compatibility | Memory Tasks 1–2; opt-out, confinement, conflict and UTF-8 budgets |
| Replay/offline/zero-model animation | Foundation Tasks 2–3; host Task 1; UI Tasks 1–3 |
| User-ready setup, uninstall, tutorial | Distribution Tasks 1–3; clean native installs and captioned walkthrough |
| Cute original design + accessible alternatives | UI Tasks 2–3; keyboard/reduced-motion/mobile checks |

Self-review completed: checked spec coverage, task granularity, shared types/exports, review-focus ownership and test assertions. Tests described here are **planned**, not executed V2 results. No V2 runtime, hook installation, skill download, host-setting change or vault migration has been performed by writing this plan.

## Handoff

Preserve the previously chosen native/inline execution method: implement in this chat, with the required whole-branch review at completion. Planning is ready for owner review before implementation, as required by the writing-plans skill. Approval covers this implementation plan; it does not turn a future recommendation into permission to install every suggested third-party skill.
