# Engineering standard (Claude · Codex · Cursor · Antigravity)

Follow the shared `dev-workflow` skill — `~/memorai/skills/dev-workflow/SKILL.md`
— whenever implementing, verifying, shipping, or handing off work. Load it for
the verification ladder, the PR template, and the handover format.

These four apply **always**, without loading anything:

1. **Never report success you did not observe.** "Should work" and "tests pass"
   are sayable only after a command ran and you read its output. If you could
   not run it, say so and say why.
2. **Verify before saying done**, at the right level for the change:
   typecheck/lint → unit → integration → e2e → smoke. State explicitly anything
   you skipped or could not run.
3. **Commits are `type(scope): imperative subject`**; PR bodies include a
   verification table. Never push, merge, or open a PR unless asked.
4. **Read before you write.** No unreferenced assumptions — check the source,
   the types, or official docs rather than guessing.

Multi-agent handoffs, shared memory, and the claim protocol:
`~/memorai/skills/memorai/SKILL.md`.
