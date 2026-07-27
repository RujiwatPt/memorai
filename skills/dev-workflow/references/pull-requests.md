# Commits & Pull Requests

## Title format

```
type(scope): imperative subject
```

`feat(pricing): connect stripe integration`

Rules:
- **type** — from the table below, lowercase, required.
- **scope** — the affected area, lowercase, one word or hyphenated
  (`pricing`, `auth`, `user-profile`, `ci`). Required unless the change is
  genuinely repo-wide.
- **subject** — imperative mood ("add", not "added"/"adds"), lowercase first
  letter, **no trailing period**, ≤ 72 characters total for the line.
- Say what the change *does*, not what you did: `fix(cart): prevent duplicate
  line items on rapid clicks` beats `fix(cart): fixed a bug`.

### Types

| Type | Use for |
|---|---|
| `feat` | A new user-facing capability |
| `fix` | A bug fix |
| `refactor` | Restructuring with no behaviour change |
| `perf` | A change made for performance |
| `docs` | Documentation only |
| `test` | Adding or fixing tests only |
| `build` | Build system, bundler, or dependencies |
| `ci` | Pipelines and CI config |
| `chore` | Maintenance that fits nothing above |
| `revert` | Reverting a previous commit |

### Breaking changes

Append `!` after the scope **and** add a footer:

```
feat(api)!: return ISO timestamps instead of epoch millis

BREAKING CHANGE: `createdAt` is now an ISO-8601 string. Clients parsing it as a
number must be updated. Migration: `new Date(createdAt)` works for both.
```

## Commit body

Optional for trivial changes, expected for everything else. Wrap at 72 columns,
blank line after the subject.

```
fix(auth): refresh expired tokens before retrying the request

The interceptor retried 401s with the same expired token, so every retry failed
and the user was logged out after a short idle period.

Now the interceptor refreshes once, retries the original request, and only
propagates the failure if the refresh itself fails. A concurrency guard makes
parallel requests share a single refresh.

Fixes #482
```

Answer **why**, and **why this way** — the diff already shows what.

## Commit hygiene

- One logical change per commit. Split refactors from behaviour changes.
- Every commit should build and pass tests on its own.
- No `wip`, `fix typo`, `address review` in the final history — squash them.
- Never commit generated files, `.env`, secrets, or editor config.

## PR description template

```markdown
## What
One or two sentences: the change, in plain language.

## Why
The problem, the user impact, or the ticket. Link it: Closes #123

## How
The approach, and any design decision a reviewer would otherwise have to
reverse-engineer. Note alternatives you rejected and why.

## Verification
| Level | Result |
|---|---|
| typecheck / lint | ✅ 0 errors |
| unit | ✅ 47 passed (3 new) |
| integration | ✅ 12 passed against test DB |
| e2e | ✅ checkout flow |
| smoke | ✅ builds, boots, checkout completes with test card |

Manual check: <what you clicked through, and what you saw>

## Risk & rollback
Blast radius, feature flag if any, and how to undo this if it misbehaves.

## Screenshots
Before / after for any UI change.

## Reviewer notes
Where to look first, and anything you're unsure about.
```

Drop sections that genuinely don't apply. Never drop **Verification**.

## Before you request review

- [ ] Read your own diff top to bottom — you will find something
- [ ] No debug code, no commented-out blocks, no unrelated formatting churn
- [ ] Diff is as small as it can be; unrelated fixes moved to their own PR
- [ ] Title follows the convention; body sections filled
- [ ] Branch is up to date with the base branch
- [ ] CI is green — not "probably green"
- [ ] Docs/README/env-example updated if behaviour or setup changed

## Size

Under ~400 changed lines gets a real review; above that gets a rubber stamp. If
it's growing, split it: mechanical refactor first, behaviour change second.

## Rules of engagement

- Never open, merge, force-push, or close a PR unless the user asked you to.
- Never push directly to `main`/`master`.
- If CI fails, fix the cause. Re-running until it passes is not a fix — that's a
  flaky test you now need to report.
