---
name: dev-workflow
description: Shared engineering discipline for all desktop agents (Claude, Codex, Cursor, Antigravity) — how to write code, how to prove it works before claiming done (unit/integration/e2e/smoke), how to write conventional commits and detailed PRs, how to hand off work when approaching a context limit, and when to persist context to Memorai shared memory. Use when implementing a feature or fix, when finishing an implementation, when opening a PR or writing a commit message, when running low on context, or when starting/resuming work that another agent may have touched.
---

# Dev Workflow — Shared Engineering Standard

One standard, four agents. Whichever agent you are, you behave the same way, so
the next agent can pick up your work without re-deriving it.

**Identify yourself.** Every Memorai call needs an `agent_id`. Use exactly one
of: `claude`, `codex`, `cursor`, `antigravity`.

**Stack-agnostic.** Examples use whatever syntax reads clearly; the rules apply
to any language. Never assume the toolchain — detect it (Orient, below).

## The loop

Every non-trivial task runs through these seven phases. Don't skip phases; do
collapse them for genuinely small work — a typo fix needs no handover doc.

| # | Phase | Don't leave until… |
|---|-------|--------------------|
| 1 | **Orient** | You searched shared memory, detected the project's commands, and read the real code |
| 2 | **Plan** | You can state the change in 2–3 sentences and name the files it touches |
| 3 | **Implement** | The change matches surrounding style; scope wasn't silently widened |
| 4 | **Verify** | Commands ran and you read real output → `references/verification.md` |
| 5 | **Ship** | Commits and PR follow convention → `references/pull-requests.md` |
| 6 | **Persist** | Non-obvious decisions are in Memorai → `references/shared-memory.md` |
| 7 | **Handover** | Only if context is running out → `references/handover.md` |

## Non-negotiables

These override convenience, speed, and your own confidence.

1. **Never report success you did not observe.** "Should work", "this fixes it",
   and "tests pass" are sayable only after a command ran and you read its
   output. If you couldn't run it, say so and say why.
2. **Read before you write.** Never edit a file you haven't read this session.
   Never assume an API's shape — check the source, the types, or official docs.
3. **No unreferenced assumptions.** Don't invent flags, fields, or signatures.
   Look it up in the codebase or the official docs.
4. **Deliver the scope asked for.** Don't quietly narrow it, don't gold-plate
   it. If part is blocked, finish the rest and state plainly what you left out.
5. **Ask before irreversible or outward-facing actions** — force-push, history
   rewrite, deleting data, migrations against real data, publishing, sending.
6. **Leave the campsite clean.** No stray debug logs, commented-out code, unused
   imports, or scratch files in the diff.

## Orient

Three cheap steps before any code. Skipping these is what causes rework.

**1. Check what other agents know.**
```
search_shared_memory({ agent_id: "<you>", query: "<feature or module>" })
fetch_inbox({ agent_id: "<you>", status: "ACTION_REQUIRED" })
```
Another agent may have made a decision you're about to contradict, or left you
an explicit next step.

**2. Detect the toolchain.** Never guess the test command. Read the manifest and
task runner — `package.json` scripts, `Makefile`, `justfile`, `pyproject.toml`,
`go.mod`, `Cargo.toml`, `composer.json`, `build.gradle` — plus the CI workflow,
which is the ground truth for what must pass. Full table in
`references/verification.md`.

**3. Read the real code.** The actual files, not your memory of them. Read 2–3
neighbours to learn the local idiom before adding to it.

## References

Load what you need; don't read them all up front.

| File | Read it when |
|------|--------------|
| `references/verification.md` | You think you're done — **this is the gate** |
| `references/coding-standards.md` | Writing or reviewing any code |
| `references/pull-requests.md` | Writing a commit message or opening a PR |
| `references/handover.md` | Context is low, or handing to another agent |
| `references/shared-memory.md` | Deciding what to save to Memorai, and how |
| `references/worked-example.md` | You want the whole loop demonstrated once |

Related skill: **`standby`** — for when the user asks you to idle and watch the
Memorai inbox for handoffs instead of working on something now.

## Definition of done

The single gate. If any line is false, you are not done and must not say so.

- [ ] Every part of the requested scope is implemented
- [ ] Static checks pass — type check and lint, command run, output seen
- [ ] New behaviour has tests; the suite passes
- [ ] Verified at the right level for this change type (`references/verification.md`)
- [ ] Diff is clean — no debug code, no unrelated churn
- [ ] Commits are `type(scope): subject`; PR body includes the verification table
- [ ] Non-obvious decisions saved to Memorai
- [ ] Anything skipped or unverifiable is stated explicitly to the user
