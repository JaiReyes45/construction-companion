# V2 preview review record

Verified on 2026-11-08 (Asia/Manila). Clean `npm ci --ignore-scripts` succeeded. The final frozen-source `node --test test/*.test.mjs` run passed **67/67** tests, including independent copied MCP packages and deterministic package hashes. SQLite emits Node's experimental-feature warning on the tested 22.16.0 runtime.

A fresh whole-branch code reviewer required changes before preview publication. Each finding below was reproduced before its fix and passed afterward. The demo and dual-host setup findings were regraded from Minor to Important because they broke documented preview workflows.

| Finding | Fix and regression evidence |
|---|---|
| Setup could overwrite edits made during a long installation | Recheck each target immediately before replacement; journal original text and planned ownership in a private receipt; preserve edits on drift |
| Session end left a question and signed turn active | Persist ended status, invalidate the active turn and cancel its question; later browser replies and RPCs reject |
| An invalid notebook item poisoned the queue | Validate before enqueueing; isolate legacy permanent failures and expose their review count; valid writes continue |
| Failed startup leaked an inaccessible daemon | Close listener/store, clear timers and release matching ownership when startup fails; child process exits |
| Permission waits stayed visible after work or session termination | End correlated waits on observed work/termination without claiming approval or task success |
| Demo completion used an invalid payload | Exercise the full discovery → crew decline → sample completion journey with the event allowlist |
| Codex setup blocked adding Claude to the same project | Separate host conflict checks and owned ignore blocks; removing one preserves the other |
| Installer path confinement had no successful reviewer probe | A real elevated temporary Windows junction reproduced the risk; setup/removal now reject linked config paths |

The fresh browser reviewer ultimately returned **ship within the browser UI review scope**. Fixes preserve unsaved notebook drafts, announce incoming questions and native state, restore focus when question controls are replaced, and avoid repeated live-region mutations during polling. The browser regression covered these behaviors. Actual screen-reader user testing remains unverified.

Design documentation was completed by the parent after the documenter agent became unavailable; the visual review itself remained independent. DESIGN.md and `.impeccable/design.json` record the reviewed implementation.

## Rulings made during execution

- The separately approved V2 repository provides isolation from V1; no additional worktree was created. Cost: V2 has one working checkout.
- Git Bash bookkeeping could not start under the Windows sandbox. Node/Python and a durable ledger performed equivalent bookkeeping. Cost: helper scripts were not exercised directly.
- Native package probes followed adapter generation so there was an actual package to inspect. Version discovery alone never established compatibility.
- Internal store enumeration supports recovery; it is not exposed as a browser database API. A separate host RPC module keeps dispatch/authentication out of service state logic.
- Lifecycle implementation preceded final packaging because the packages need runnable entrypoints. Cost: validation followed dependency order rather than plan numbering.
- Codex project setup uses its documented repo marketplace/config. Measured `plugin add` enabled globally in an isolated home. Cost: per-project package copies are retained on uninstall.
- Package generation copies the pinned script-free production dependency tree after a clean npm install, instead of repeating installation for each package. Cost: release preparation must verify the lockfile install first.
- A complete native question/installation claim remains gated. Claude, Linux native acceptance, ordinary-prompt Superpowers discovery, hook trust/delivery and long-wait delivery are unverified; native-chat fallback stays active. Cost: this is a development preview, not the complete two-host user-ready upgrade.
- Automatic third-party recipes remain disabled; native provenance/reload has not been established. Cost: catalog skills use reviewed manual upstream setup.
- Filesystem checks and backups reduce accidental overwrite and path escape risks; no exhaustive hostile same-user filesystem race or dependency-internal security audit is claimed.

No reviewer Minor findings were silently deferred. Final copied-package verification, publication checks and V1 preservation are coordinator checks; the reviewer did not claim them. An earlier package hash comparison failed while source files were being edited between builds; the final run used frozen source and passed.
