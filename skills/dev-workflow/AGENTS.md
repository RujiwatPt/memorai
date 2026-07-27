# Dev Workflow — portable pointer

Some agents load `AGENTS.md` / `GEMINI.md` rather than `SKILL.md`. This file is
a short pointer so those agents still reach the standard.

**The full standard lives in `SKILL.md` next to this file. Read it before
implementing, verifying, or shipping.**

Compressed form — the seven phases:

1. **Orient** — search Memorai + check inbox, detect the project's real commands
   (task runner → manifest → CI workflow; never guess), then read the real code.
2. **Plan** — state the change in 2–3 sentences and name the files it touches.
3. **Implement** — match the surrounding codebase; deliver exactly the scope asked.
4. **Verify** — typecheck/lint → unit → integration → e2e → smoke. Run the
   commands. Never claim a result you didn't observe.
5. **Ship** — `type(scope): imperative subject`; PR body must include a
   verification table.
6. **Persist** — save non-obvious decisions to Memorai with tags.
7. **Handover** — at ~75% context, stabilize the tree and write a handover doc.

Non-negotiables: never report unobserved success · read before you write · no
unreferenced assumptions · no secrets in code or memory · ask before
irreversible or outward-facing actions.

Details: `references/verification.md`, `references/coding-standards.md`,
`references/pull-requests.md`, `references/handover.md`,
`references/shared-memory.md`. For the whole loop demonstrated on one real task,
see `references/worked-example.md`.
