# Coding Standards

Examples are illustrative, not language-specific — the rules apply wherever you
are. Where a rule names a construct (`any`, `catch {}`), read it as "the
equivalent in this language": `Any` in Python, `interface{}` in Go, `mixed` in
PHP, a bare `except:`/`rescue`/`catch (Exception)`.

## The prime directive: match the codebase

Your code should be indistinguishable from the code around it. Before writing:

- Read 2–3 sibling files. Copy their naming, error handling, import style,
  file layout, and comment density.
- Use the libraries already in the project. Check `package.json` /
  `pyproject.toml` / `go.mod` before reaching for anything new.
- A "better" pattern that nothing else in the repo uses is a worse pattern.
  Consistency beats personal preference. Propose the migration separately.

## Design principles

**DRY** — Extract on the *third* occurrence, not the second. Two similar blocks
that are likely to diverge should stay duplicated; premature abstraction is more
expensive to unwind than duplication.

**SOLID**, applied with judgement:
- *Single responsibility* — a function that needs "and" to describe it is two functions.
- *Open/closed* — extend via new cases, don't rewrite working code paths.
- *Liskov* — a subtype must be safe wherever the base type is used.
- *Interface segregation* — narrow interfaces; don't force callers to know about what they don't use.
- *Dependency inversion* — depend on interfaces at module boundaries so tests can substitute.

**YAGNI** — Build what was asked. No speculative config options, no plugin
systems for one plugin, no abstraction layer for one implementation.

## Types

- No `any`. If you truly cannot type it, use `unknown` and narrow at the boundary
  with an explicit guard. `any` silently disables checking for everything downstream.
- Type the boundaries: function signatures, exported values, API payloads. Let
  inference handle locals.
- Make illegal states unrepresentable. A discriminated union beats a bag of
  optional fields that must be checked in combination.
- Validate external data at the edge (HTTP responses, env vars, files, user input)
  with a schema — a TypeScript type is a compile-time claim, not a runtime check.
- Run the type checker. A type error is a failing test.

## Errors

- Fail fast and loudly at the boundary; handle deliberately where you can recover.
- Never swallow: `catch {}` and `except: pass` are bugs. If it's genuinely
  ignorable, log it and write the one-line comment saying why.
- Error messages name the thing and the fix: `Missing STRIPE_SECRET_KEY — set it
  in .env.local` beats `Configuration error`.
- Preserve the cause when re-throwing (`{ cause: err }`, `raise ... from err`).
  Stack traces you destroy cost the next debugger an hour.
- Don't catch what you can't handle. Let it propagate to a layer that can.

## Naming

- Reveal intent: `retryCount` not `n`, `isEligibleForRefund` not `flag`.
- Booleans read as predicates: `is/has/should/can`.
- Functions are verbs, values are nouns. Async functions that fetch say so.
- Avoid abbreviations except ones the codebase already uses everywhere.
- No numbered suffixes (`handleData2`, `UserNew`) — that's a naming failure.

## Comments

Explain **why**, never **what**. The code says what.

```ts
// BAD: increment the retry counter
retryCount++;

// GOOD: Stripe rate-limits bursts, so back off exponentially rather than
// retrying immediately — see incident 2026-03-11.
```

Comment: non-obvious business rules, deliberate deviations, workarounds (with a
link to the issue), and anything that looks wrong but is correct. Delete
commented-out code — that's what git is for.

## Functions and structure

- Small enough to hold in your head. If you're scrolling, split it.
- Guard clauses over nested conditionals — return early, keep the happy path flat.
- Avoid boolean parameters that change behaviour (`render(true)`); pass an option
  object or split the function.
- Pure where practical. Isolate I/O and side effects so the logic is testable.
- Keep functions at one level of abstraction — don't mix byte manipulation and
  business orchestration in the same body.

## Dependencies

Before adding one, ask: is it in the repo already? Can the stdlib do it in ~20
lines? Is it maintained? Adding a dependency is a permanent maintenance,
security, and bundle-size commitment — and it needs the user's agreement, not just yours.

## Security baseline

- Never commit secrets. They go in env vars, read through one config module.
  If you find a committed secret, stop and tell the user — it must be rotated.
- Parameterize queries. String-concatenated SQL is never acceptable.
- Validate and sanitize all external input before it reaches a sink (DB, shell,
  HTML, filesystem path).
- Authorize on the server for every request. Client-side checks are UX, not security.
- Don't log secrets, tokens, full payment details, or PII.

## Performance

Correct first, then measure, then optimize — with the profile in hand. But don't
write knowingly quadratic code over unbounded input, and don't put a query inside
a loop (N+1). Those aren't premature optimization; they're defects.

## Git hygiene while working

- Branch off the default branch; never commit directly to `main`/`master`.
- Commit logically-separable units separately. A refactor and a feature in one
  commit is unreviewable.
- Only commit and push when the user asks.
