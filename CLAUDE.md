# AutoGTG Monorepo — Claude Instructions

## Testing (required for every feature)

Every new feature or bug fix **must** include tests. No exceptions.

### Unit tests (Vitest + React Testing Library)

Run all apps in parallel:
```
pnpm test
```

Run / watch one app during development:
```
cd apps/<user-pwa|ops|garage-pwa>
pnpm test          # one-shot
pnpm test:watch    # watch mode
pnpm test:coverage # coverage report
```

**What to test:**
- Pure functions in `lib/utils.ts` — every branch
- New utility functions in any `lib/` module — full coverage
- UI components — render output, click/input interactions, loading & disabled states, conditional rendering
- Store logic — state transitions, edge cases
- API route handlers — mock `Request`, assert `Response` status and body

**Where to put tests:** Co-locate with source. `Button.tsx` → `Button.test.tsx` in the same directory.

**Vitest config:** Each app has `vitest.config.ts`. Path alias `@/` resolves to `src/` in that app.

### E2E tests (Playwright)

```
pnpm test:e2e       # headless (needs dev servers running or auto-started by webServer config)
pnpm test:e2e:ui    # interactive Playwright UI
```

Specs live in `e2e/` at the monorepo root.

**What to cover per feature:**
- Happy path for every new user-facing flow
- Auth gates (redirect when unauthenticated)
- Any navigation or routing changes

### Before pushing

1. `pnpm test` — all unit tests green
2. `pnpm test:e2e` — E2E smoke tests pass

---

## Audit Logging (required for all mutations)

Every feature that writes, updates, or deletes data **must** emit an audit log entry.
This is non-negotiable — do not skip it even for small patches or internal tools.

### Rule

**Before returning a success response from any server action or API route that mutates state, call `appendAuditEntry(...)` from `@/lib/audit/log`.**

### What to log

| Field | Value |
|---|---|
| `action` | Verb + noun snake_case, e.g. `patch_mechanic`, `add_call_attempt`, `delete_booking` |
| `entityType` | The domain object being mutated, e.g. `mechanic`, `booking`, `user` |
| `entityId` | Primary key of the record |
| `actor` | Caller identity — use `request.headers.get("x-actor") ?? "unknown"` until auth is wired |
| `payload` | The incoming patch/body (omit secrets/PII if present) |
| `before` | Snapshot of the record *before* the mutation (if cheap to obtain; omit if not) |
| `outcome` | `"success"` or `"error"` |
| `error` | Error message string when `outcome === "error"` |

### Where audit lives

- **ops app** → `apps/ops/src/lib/audit/` (already implemented)
  - Store: same dual filesystem (`data/audit-log.json`) / Netlify Blobs (`audit-log` store) pattern
  - Read endpoint: `GET /api/audit`
- **New apps** → replicate the same pattern under their own `src/lib/audit/`

### Adding audit to a new app

1. Copy `apps/ops/src/lib/audit/` into the new app.
2. Create `GET /api/audit/route.ts` to expose it to ops reviewers.
3. Call `appendAuditEntry(...)` in every mutating API route.

### Existing code — backfill checklist

When touching existing routes, add audit at the same time:

- [x] `apps/ops` — `PATCH /api/mechanics/[id]` → logs `patch_mechanic`
- [x] `apps/ops` — `POST /api/mechanics/[id]/call-log` → logs `add_call_attempt`
- [ ] Any future routes you add

### Admin review

`GET /api/audit?limit=200` is gated by the `AUDIT_SECRET` env var.
Set it in Netlify env vars and pass it as `x-audit-secret: <value>` (or `Authorization: Bearer <value>`).
The `/audit` page in the ops app renders the same data server-side (no header needed — it calls the lib directly).
Until real session auth lands, keep `AUDIT_SECRET` out of client-side code.
