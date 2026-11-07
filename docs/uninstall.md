# Removal and recovery

Run `node bin/construction-companion.mjs uninstall --host codex --project "/absolute/project"` (or `--host claude`). It stops the runner, disables its project observation receipt and removes unchanged owned activation entries. User-edited entries are preserved and reported for manual review. Other config text and marketplace plugins remain intact.

Project code, notebook pages, event history and the copied package are retained. Retained packages can be inspected or manually removed after checking the printed path; setup refuses to overwrite an existing package. Codex keeps the registered cache entry disabled user-wide; no shared cache or notes are recursively deleted. Uninstall does not revoke native trust entries you may have reviewed yourself. Remove the retained `.construction-companion/<host>` folder before a fresh reinstall if you no longer need it.

`stop` sends an authenticated request to the matching local instance. It never kills a PID from disk. A live or ambiguous startup lock is left for review. If startup fails, check `doctor`; stop your own confirmed companion process before removing a stale runtime lock. Do not delete a lock simply because a port is unavailable.

Memory write conflicts retain the accepted coding answer and pending note. Ask your coding host to read the current note, reconcile the summary with your edits and submit a new operation using the current hash. Existing backups are never overwritten with different content. A `.lock` next to a note can survive a process crash: confirm no companion writer is active before manually removing that exact lock. Files outside managed note regions are preserved.

To disconnect a browser, use **Disconnect** or close the tab. It clears the tab's token. `stop` and a new `start` rotate runtime credentials; run `connect --copy-token` again. Clipboard contents are local and remain until you replace them.
