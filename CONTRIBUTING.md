# Contributing

Use Node.js >=22.13 and `npm ci --ignore-scripts`. Run `npm test` and `node scripts/release-check.mjs`. Keep dependencies pinned. Run native acceptance on each claimed host/version/platform; fixtures alone do not prove compatibility.

Keep model execution and permissions in the coding host. Do not add telemetry, prompt logging, whole-vault scanning, automatic skill installers or hidden model sessions. Changes to event fields require explicit validation and privacy review. Reproduce substantive regressions with a failing test before fixing them.

Keep V1 in its separate archive. Generated packages and private test artifacts do not belong in source control. See the approved spec and implementation plans under docs/superpowers.
