# V2 tutorial

The captioned tutorial records the actual local browser interface with **simulated host events**. It demonstrates browser behavior, not a verified native Codex or Claude session. The video is distributed as a preview release asset; the source repository keeps this transcript.

[Watch or download the one-minute tutorial](https://github.com/JaiReyes45/construction-companion/releases/download/v0.1.0-preview.1/construction-companion-v2-tutorial.mp4) · [Download SRT captions](https://github.com/JaiReyes45/construction-companion/releases/download/v0.1.0-preview.1/construction-companion-v2-tutorial.srt)

To try the same interaction, install source dependencies with `npm ci --ignore-scripts`, then run `node scripts/demo.mjs --copy-token`. Open the printed local URL, paste the copied token, and connect. The visible demo banner remains on screen. Ctrl+C stops the demonstration.

## Transcript

1. Construction Companion V2 is a local browser companion. This demonstration uses simulated activity and makes no model request.
2. For a real configured project, run `start`, then `connect --copy-token`. Open the local URL and paste the token. Consult the README for exact source commands.
3. Answer the head engineer using a choice or your own words. Real host questions stay in native chat in this preview until acceptance is verified.
4. Wait for the server's acknowledgement. Old or duplicate replies cannot resume another question.
5. A recommended architect skill shows its role and purpose. Review an installation, choose another skill, or continue without one. Choosing a worker does not prove it is running.
6. Continue without is a normal choice. It suppresses repeat recommendations for that task and role.
7. Project notebook is optional. Enable it to save approved summaries as Markdown you can open in Obsidian. Full chats are not copied. You can turn capture off again.
8. Permissions stay in Codex or Claude Code. A game answer never approves a shell command.
9. Disconnect clears the tab's current project. Stop the runner with the `stop` command. Native hooks and full question delivery still require acceptance testing.

Video captions explicitly identify the preview limitations. Do not present the recording as evidence of native Superpowers discovery or a completed host installation.
