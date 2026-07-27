# Verification — Proving It Works

**The rule:** an implementation is a hypothesis until a command has proven it.
You may not say "done", "fixed", "working", or "tests pass" without having run
something and read the output.

Writing the code is ~60% of the task. This is the other 40%.

## Step 0 — find the commands (never guess them)

Guessing `npm test` in a Poetry repo wastes a turn and teaches you nothing. In
priority order:

1. **The task runner**, if present — `Makefile`, `justfile`, `Taskfile.yml`.
   `make test` is usually the intended entry point; prefer it over the raw tool.
2. **The manifest's script block** — `package.json#scripts`,
   `pyproject.toml#[tool.poetry.scripts]`, `composer.json#scripts`,
   `Cargo.toml`, `build.gradle`.
3. **The CI workflow** — `.github/workflows/*.yml`, `.gitlab-ci.yml`. This is
   ground truth: whatever CI runs is what must pass. If unsure, mirror CI exactly.
4. **CONTRIBUTING.md / README** — often documents the local dev loop.

Typical commands by ecosystem, once you know which applies:

| Stack | Static | Test | Build |
|---|---|---|---|
| Node/TS | `tsc --noEmit`, `eslint .`, `biome check` | `vitest run`, `jest`, `npm test` | `npm run build` |
| Python | `mypy .`/`pyright`, `ruff check` | `pytest -q` | `python -m build` |
| Go | `go vet ./...`, `golangci-lint run` | `go test ./...` | `go build ./...` |
| Rust | `cargo clippy -- -D warnings` | `cargo test` | `cargo build --release` |
| Java/Kotlin | `./gradlew check` | `./gradlew test`, `mvn test` | `./gradlew build` |
| PHP | `phpstan analyse`, `php-cs-fixer` | `phpunit`, `pest` | `composer install --no-dev` |
| E2E (any) | — | `playwright test`, `cypress run` | — |

Respect the package manager in use — a `pnpm-lock.yaml` means `pnpm`, not `npm`.
In a **monorepo**, run the workspace's own scripts (`pnpm --filter <pkg> test`,
`nx affected -t test`, `turbo run test --filter=...`) and verify every package
your change touches, not just the one you edited.

If a project genuinely has no tests, say so, and ask before building a harness —
that's a scope change.

## The ladder

Climb cheapest → most expensive. A failure at any rung stops the climb: fix it,
then restart from that rung.

### 0. Static — every change, no exceptions
Type check + lint + format. Zero errors, zero **new** warnings. Never silence a
rule to get green without saying so and why.

### 1. Unit — any logic you added or changed

Test behaviour, not implementation. One test = one behaviour. Cover at minimum:
the happy path, each **boundary** (empty, zero, one, max, null), and each
**error path** you wrote a throw/catch for.

Quality bar:
- **Arrange–Act–Assert**, visibly separated.
- Names state the behaviour: `returns 0 when the cart is empty`, not `test cart`.
- Assert outcomes, not internal call counts. Mocking the module under test means
  you're testing the mock.
- Mock only what you don't own: network, clock, filesystem, third-party SDKs.
- **A test that has never failed proves nothing.** Break the implementation on
  purpose once and confirm it goes red. Still green ⇒ the test is wrong.
- No conditionals or loops in tests. Logic in a test means it needs splitting.

### 2. Integration — when a change crosses a boundary

Required whenever you touched a DB query, an API route, a queue, or a service
call. Use a real test database or a contract-level fake — never a hand-written
mock that echoes your own assumptions back at you.

Verify the request/response contract, what actually landed in the store, error
and status codes, and the rollback path.

### 3. E2E — when a user-visible flow changed

Required for UI flows, auth, checkout, and anything a user clicks through.
Drive the real app: `login → navigate → act → assert visible outcome`.

- Select by role, label, or `data-testid` — never CSS class or DOM position.
- Wait for conditions, never `sleep(n)`. Arbitrary sleeps are the top cause of flake.
- Assert what the user sees **and** the persisted side effect.
- Run it twice. A test that passes only sometimes is failing.

### 4. Smoke — before calling the whole thing shippable

The 60-second "is it fundamentally alive" pass, on a build as close to
production as you can get:

- [ ] Builds clean — no errors, no new warnings you introduced
- [ ] Starts — boots with no exceptions in the first 10 seconds of logs
- [ ] Health/root endpoint responds
- [ ] **The primary path of the feature you just built** works end to end, once,
      by hand (or via browser/simulator tools if you have them)
- [ ] Console and server logs clean — no new errors
- [ ] A pre-existing critical path still works (you didn't break login)

## Which rungs does my change need?

| Change | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Pure function / util | ✅ | ✅ | — | — | — |
| Bug fix | ✅ | ✅ regression test first | if it crossed a boundary | — | ✅ |
| API endpoint | ✅ | ✅ | ✅ | — | ✅ |
| DB schema / migration | ✅ | ✅ | ✅ + rollback tested | — | ✅ |
| UI component | ✅ | ✅ | — | if in a key flow | ✅ |
| User-facing flow | ✅ | ✅ | ✅ | ✅ | ✅ |
| Config / dependency bump | ✅ | — | — | — | ✅ |
| Refactor (no behaviour change) | ✅ | existing suite passes **unchanged** | — | — | ✅ |

## Bug fixes: reproduce first

Never fix a bug you haven't reproduced.

1. Write a test that fails **for the reason in the report**.
2. Watch it fail — this proves you found the cause, not a symptom.
3. Fix it. 4. Watch it pass. 5. Run the full suite.

Can't reproduce it? Say so and ask for the missing conditions. Never ship a
speculative change described as a fix.

## Reporting results

Evidence, not adjectives. Give the user a compact table:

```
Verification
  typecheck   ✅ tsc --noEmit — 0 errors
  lint        ✅ eslint . — 0 warnings
  unit        ✅ 47 passed, 0 failed (3 new in pricing.test.ts)
  integration ✅ 12 passed — checkout route against test DB
  e2e         ⚠️  not run — no Playwright config in this repo
  smoke       ✅ builds, boots, checkout completes with test card
```

- **Failures are reported, never hidden.** Paste the relevant output.
- ⚠️ for anything skipped, with the reason. Silence about a skipped rung is a
  false claim of completeness.
- Flaky ≠ passing. Say "passed on 2nd run, investigating flake".

## When you can't run the tests

State it immediately and plainly — don't paper over it:

> Couldn't run the e2e suite: it needs `DATABASE_URL` for the test container,
> which isn't set here. Unit + integration pass. To verify locally:
> `docker compose up -d db && npm run test:e2e`

Then hand the user the exact commands.

## Anti-patterns

- Editing a test to match broken behaviour instead of fixing the behaviour.
- Deleting, skipping, or `.only`-ing a failing test to get green.
- Widening a mock until the assertion passes.
- Assertion-free tests, or `expect(true).toBe(true)`.
- "All tests pass" when you ran only the file you touched.
- Committing leftover `.only`, `.skip`, or debug prints.
