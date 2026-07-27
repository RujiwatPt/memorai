# Worked Example — The Loop, Once, End to End

One realistic task shown in full, so the shape is concrete. Task: *"Connect
Stripe so users can pay for a subscription."*

---

## 1. Orient

```
search_shared_memory({ agent_id: "claude", query: "stripe payments billing" })
→ 1 hit: "Billing: no vendor chosen yet, but PCI scope must stay out of our
   servers — decided 2026-06. Use a hosted checkout, never raw card fields."
fetch_inbox({ agent_id: "claude", status: "ACTION_REQUIRED" })
→ empty
```

That memory just eliminated a whole design branch. **Stripe Checkout, not Elements.**

Detect the toolchain:
```
package.json → "test": "vitest run", "typecheck": "tsc --noEmit", "lint": "eslint ."
pnpm-lock.yaml present  → use pnpm, not npm
.github/workflows/ci.yml → runs typecheck, lint, test:unit, test:integration
```

Read the real code: `src/api/`, an existing route for the idiom, `src/db/schema.ts`.

## 2. Plan

> Add a Checkout session endpoint and a webhook handler. `POST /api/checkout`
> creates a Stripe Checkout session and returns its URL; `POST /api/webhooks/stripe`
> verifies the signature and activates the subscription on `checkout.session.completed`.
> Touches: `src/api/checkout.ts` (new), `src/api/webhooks/stripe.ts` (new),
> `src/db/schema.ts` (add `subscriptions`, `processed_events`).

Stated in two sentences, files named. Now implement.

## 3. Implement

Following the local idiom found in step 1. Two decisions worth noting for later:

- Webhook signature verified with the raw body — the JSON body parser must be
  disabled on that route, or verification silently fails.
- Stripe retries webhooks up to 3×, so the handler dedupes on `event.id` via a
  unique index on `processed_events.stripe_event_id`.

## 4. Verify

Change type = *user-facing flow* ⇒ all five rungs required.

```bash
pnpm typecheck && pnpm lint          # rung 0
pnpm test src/api/checkout.test.ts   # rung 1
pnpm test:integration                # rung 2
pnpm test:e2e --grep checkout        # rung 3
pnpm build && pnpm start             # rung 4
```

Rung 1 — one behaviour per test, boundaries and error paths covered:

```ts
it('returns a checkout url for a valid plan', ...)
it('rejects an unknown plan id with 400', ...)
it('rejects an unauthenticated request with 401', ...)
it('ignores a duplicate webhook event id', ...)   // the retry guard
it('rejects a webhook with an invalid signature', ...)
```

Then the mutation check: temporarily invert the dedupe condition → the duplicate
test goes red. Good, it's really testing something. Revert.

Rung 4, by hand: `4242 4242 4242 4242` → redirected to Checkout → paid →
returned to the app → subscription shows **active** → row present in the DB, one
row only. Logs clean.

Report to the user:

```
Verification
  typecheck    ✅ tsc --noEmit — 0 errors
  lint         ✅ eslint . — 0 warnings
  unit         ✅ 52 passed (5 new)
  integration  ✅ 14 passed — checkout + webhook against test DB
  e2e          ✅ checkout flow, run twice, stable
  smoke        ✅ builds, boots, test-card payment activates subscription
```

## 5. Ship

```
feat(pricing): connect stripe integration

Adds subscription checkout via Stripe Checkout (hosted), keeping card data
entirely off our servers per the PCI decision in 2026-06.

POST /api/checkout creates a session and returns its URL. The webhook handler
verifies the signature against the raw body and activates the subscription on
checkout.session.completed. Stripe retries deliveries, so events are deduped on
event.id via a unique index rather than an app-level check alone.

Closes #218
```

PR body uses the template in `pull-requests.md`, with the verification table
above pasted into the Verification section, plus:

> **Risk & rollback** — behind `FEATURE_BILLING`, default off. Rollback: flip
> the flag; no destructive migration (both tables are additive).

## 6. Persist

Save what the code doesn't say:

```json
{
  "agent_id": "claude",
  "topic": "Pricing: Stripe webhook idempotency + raw-body signature",
  "content": "src/api/webhooks/stripe.ts:64 dedupes on event.id via processed_events (unique index on stripe_event_id). Stripe retries up to 3x; without this, duplicate checkout.session.completed events double-activated subscriptions. Do not remove the unique index — it is the real guard, the app-level check is only a fast path. Signature verification needs the RAW body, so the JSON parser is disabled for this route in src/api/index.ts:31; re-enabling it breaks verification silently with no error.",
  "tags": ["pricing", "stripe", "webhooks", "gotcha"]
}
```

Note what makes this worth saving: a **file:line**, a **why**, and a **don't
break this**. None of it is inferable from reading the diff.

## 7. Handover — only if context ran out

Say context hit ~75% after rung 2. Stabilize, then:

```markdown
# Handover: Stripe checkout integration
From: claude · Date: 2026-07-25 · Branch: feat/stripe-checkout

## Status
In progress — ~70%. Compiles. Unit + integration green; e2e not yet written.

## Completed
- POST /api/checkout — `src/api/checkout.ts:1` — 3 unit tests, integration green
- Webhook handler + dedupe — `src/api/webhooks/stripe.ts:64` — 2 unit tests

## In progress
- e2e spec — `e2e/checkout.spec.ts:1` — skeleton only, no assertions yet

## Key decisions (and why)
- Hosted Checkout, not Elements — keeps PCI scope off our servers (memory, 2026-06)
- Dedupe via unique index, not app-level check — Stripe retries 3x

## Dead ends — do not repeat
- Verifying the signature with the parsed body: always fails. Needs the raw body;
  parser disabled at `src/api/index.ts:31`.

## Next steps
1. Finish `e2e/checkout.spec.ts` — card 4242…, assert subscription row is active
2. Run rung 4 smoke with `FEATURE_BILLING=1`

## Gotchas
- Needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in `.env.local`
- Local webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
```

Then `save_shared_memory` (tag `handover`) and `send_agent_message` with
`ACTION_REQUIRED` to your **successor in the ring** — you're `claude`, so
`to_agent: "cursor"` — opening the content with `relay: origin=claude hop=1`.
Then tell the user where it all lives.

---

## The compressed version

Search memory → detect commands → read code → plan in 2 sentences → implement in
the local idiom → climb the ladder and paste real output → conventional commit
with a verification table → save the non-obvious → hand off cleanly if you run out.
