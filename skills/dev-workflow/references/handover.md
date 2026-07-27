# Handover — Ending Cleanly

The failure mode this prevents: an agent burns its remaining context mid-edit,
stops with a half-applied refactor and no record of intent, and the next agent
(or the user) has to reconstruct everything from a broken working tree.

## When to start handing over

Trigger on the **earliest** of these — not when you're already out of room:

- Context is ~75–80% consumed.
- The user says they're switching tools, or asks you to hand off.
- The task needs a capability you don't have (another agent has the MCP, the
  IDE integration, the browser session).
- You've looped 3+ times on the same failure without progress. Hand off with
  what you ruled out; a fresh agent without your dead ends will do better.

**Reserve budget.** Handover costs real tokens. Start it while you still have
enough left to write it properly. A rushed handover is barely better than none.

## Stabilize first

Never hand over a broken tree if you can avoid it. In priority order:

1. **Reach a consistent state.** Finish the in-flight edit, or revert it. Never
   leave a half-renamed symbol or a partially-applied migration.
2. **Make it compile.** If you can't, say exactly which file and error remain.
3. **Run the tests** and record the actual current result — including failures.
   The next agent needs the true baseline, not an optimistic one.
4. **Commit work in progress** on a branch, if the user has authorized commits:
   `chore(wip): <area> — handover, see PR description`. Otherwise leave it
   uncommitted and say so.

## Write the handover

Save it to a file in the repo (`HANDOVER.md`, or a scratch path) **and** push it
to Memorai so any agent can find it.

```markdown
# Handover: <task>
From: <agent_id> · Date: <YYYY-MM-DD> · Branch: <branch>

## Goal
What the user actually asked for, in their terms. Include the original request
verbatim if it was specific.

## Status
Done / In progress / Blocked — and the honest percentage.

## Completed
- <thing> — `path/to/file.ts:42` — verified by <which test/command>

## In progress
- <thing> — `path/to/file.ts:88` — what's half-done and what state it's in

## Not started
- <remaining scope>

## Current state of the tree
- Compiles: yes / no (<error>)
- Tests: 45 passed, 2 failed (`cart.test.ts` — expected, see Known issues)
- Committed: yes, branch `feat/x` / no, uncommitted changes in <files>

## Key decisions (and why)
- Chose X over Y because Z. Don't undo this without reading <link//file>.

## Dead ends — do not repeat
- Tried A → failed because B. Tried C → also failed, same root cause.

## Next steps
1. <specific, actionable first move — file and function named>
2. <next>

## Gotchas
- Env vars needed: <...>
- Setup command: `<...>`
- <trap that cost you time>

## Open questions for the user
- <anything that needs a human decision>
```

Then persist and notify. The recipient is your **successor in the ring**
(`claude → cursor → codex → antigravity → claude`) unless the user named someone
— see `references/shared-memory.md` for the routing and relay-stop rules:

```
save_shared_memory({
  agent_id: "<you>",
  topic: "Handover: <task>",
  content: "<the doc above, or a tight summary + file path>",
  tags: ["handover", "<project>", "<module>"]
})

send_agent_message({
  from_agent: "<you>",
  to_agent: "<your successor in the ring — never 'all'>",
  topic: "Handover: <task>",
  content: "Status + next steps + where the full doc lives.",
  status: "ACTION_REQUIRED"
})
```

That originates a handoff, so omit `relay_parent_id`. When relaying a received
handoff, pass its claimed message id as `relay_parent_id`; Memorai derives the
origin and hop count and rejects a second child or a full lap.

## Tell the user

Don't hand off silently. In your final message, say: what's done, what's not,
where the handover doc is, which agent you notified, and the exact first command
they or the next agent should run.

## Receiving a handover

If you were idling when it arrived, the `standby` skill governs how you claim it
— use `claim_message` before starting (atomic; only one agent wins).

1. `fetch_inbox({ agent_id: "<you>", status: "ACTION_REQUIRED" })`
2. `search_shared_memory` for the topic and module.
3. Read the handover doc **and** verify its claims — check the branch, run the
   tests yourself. Handover docs go stale; the tree is the truth.
4. `mark_message_status` → `READ`, and set the task board entry to `IN_PROGRESS`.
5. Confirm to the user what you picked up and what you're doing first.
6. Respect the "dead ends" list. If you must retry one, say why.

## Quality bar

Someone with **zero** context should be able to resume from your doc alone.
Absolute paths, real file:line references, exact commands, no "as discussed
earlier", no pronouns without antecedents.
