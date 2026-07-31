# dev-workflow

A shared engineering standard used by all four desktop agents — **Claude**,
**Codex**, **Cursor**, and **Antigravity** — so any of them can pick up work
another one left behind.

## Layout

Skills live in this repo and are symlinked into each agent. The repo is the
single source of truth: edit here, commit here, and the change is live
everywhere at once.

```
~/memorai/
├── scripts/sync-skills.sh         ← links every skill into all four agents
└── skills/
    ├── memorai/                   ← Memorai MCP tool reference
    ├── standby/                   ← idle watch on the Memorai inbox
    └── dev-workflow/              ← this skill
        ├── SKILL.md               ← entry point: the loop + non-negotiables + DoD
        ├── AGENTS.md              ← pointer for agents that read AGENTS.md/GEMINI.md
        ├── README.md              ← this file (humans)
        └── references/
            ├── verification.md    ← static → unit → integration → e2e → smoke
            ├── coding-standards.md
            ├── pull-requests.md   ← conventional commits + PR template
            ├── handover.md        ← running out of context
            ├── shared-memory.md   ← Memorai policy + the handoff ring
            └── worked-example.md  ← the whole loop demonstrated once
```

## Install / update

```bash
bash ~/memorai/scripts/sync-skills.sh
```

Links **every** skill in `skills/` into all four agents. Idempotent, and it
refuses to clobber a real directory or an existing symlink that points
elsewhere. Verify an existing install:

```bash
bash ~/memorai/scripts/sync-skills.sh --check
```

Sync just one skill:

```bash
bash ~/memorai/scripts/sync-skills.sh standby
```

Links land in `~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`
(Antigravity), and `~/.cursor/skills-cursor/`. Restart an agent to pick up
changes.

**Standalone copy?** Skills are meant to live in this repo. If you copy a skill
folder elsewhere, run `bash ~/memorai/scripts/sync-skills.sh <name>` from a
memorai clone to symlink it back into your agents — there is no per-skill
installer.

## Making it actually apply

Installing a skill is **not** the same as applying it. A skill only activates
when the model matches your request to its description — fine for "help me write
a PR", useless for "never claim success you didn't observe", which has to hold on
every task without being asked for.

So there are two layers, and both are needed:

| Layer | Script | What it does |
|---|---|---|
| **Install** | `sync-skills.sh` | Symlinks each skill into all four agents |
| **Instruction** | `sync-agent-rules.sh` | Puts the non-negotiables in each agent's always-on file |

```bash
bash ~/memorai/scripts/sync-agent-rules.sh          # write / update
bash ~/memorai/scripts/sync-agent-rules.sh --check  # verify
bash ~/memorai/scripts/sync-agent-rules.sh --show   # print, to paste into Cursor
```

It writes `AGENT_RULES.md` into `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and
`~/.gemini/GEMINI.md`, fenced by markers so re-runs update in place and anything
you wrote outside them is preserved. Edit `AGENT_RULES.md`, re-run, and every
agent picks up the change.

**Cursor is the exception** — its user rules live in the app UI, not a file. Run
`--show` and paste the block into Settings → Rules (User Rules).

## Editing

Edit the copy in this repo, then commit. Every agent reads the same files
through symlinks, so one edit propagates everywhere — and because it's under
version control, changes are reviewable and revertible.

Keep `SKILL.md` short. It's always in context when the skill triggers, whereas
`references/*` load only when needed. New material belongs in a reference file.

## Related

`skills/standby/` — standby mode: idle and watch the Memorai inbox for handoffs.
Includes `watch.sh` for agents with no idle scheduler.

## Notes

- **Cursor** manages `~/.cursor/skills-cursor/` with its own sync process. The
  symlink is correct, but if Cursor ever prunes unmanaged entries, re-run the
  sync script.
- **Antigravity** reads from `~/.gemini/skills/`, not `~/.antigravity/` (that
  holds only the VS Code extension host).
- Third-party skills installed by other tooling still live in
  `~/.agents/skills/` and are not managed by this script.
