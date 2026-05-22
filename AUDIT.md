# Waan Monorepo — Production Readiness Audit

**Date:** 2026-05-21
**Auditor:** Claude (Opus 4.7)
**Scope:** All three apps (`user-pwa`, `ops`, `garage-pwa`), shared infra, pipeline integrity

---

## TL;DR

**Is it functional as a product? No.**

The three apps are polished UI shells with **virtually no real backend**. They are **completely siloed** — a booking made in `user-pwa` never reaches `ops` or `garage-pwa`. Each app reads/writes its own `sessionStorage` or local JSON file. Refresh the page and the booking is gone.

- UI completeness: **~70%**
- Backend completeness: **~10%**
- Overall production-readiness: **2.5 / 10 (prototype stage)**

**Do not launch until Tier 1 items below are complete.**

---

## 1. What Each App Does Today

### A. `user-pwa` — Customer booking app

| Flow | Status | Notes |
|---|---|---|
| Home + service picker | Real UI | Repairs / detailing / denting |
| Garage search | **Mock** | Reads `lib/mock/garages.ts` (hardcoded) |
| Booking (slot → review → pay) | Real UI | 3-step flow works end-to-end visually |
| Booking confirmation | Real UI / **mock data** | Call masking is an Exotel stub |
| Booking history | Real UI | Reads `sessionStorage` only |
| Login | **Real** | OTP via WhatsApp Meta Cloud API |
| Profile | Stubbed | Name entry only |
| Payment | **Mock** | 1.5s fake "Razorpay delay" — no real gateway |

**Key file:** `apps/user-pwa/src/app/booking/pay/page.tsx:62` — calls `createJob()` which writes to `sessionStorage` (`apps/user-pwa/src/lib/store/jobs.ts:44`). The booking **never leaves the browser**.

### B. `ops` — Operations dashboard

| Flow | Status | Notes |
|---|---|---|
| Mechanics list (search/filter) | **Real** | Reads `data/mechanics.json` (270KB scrape) |
| Mechanic patch (status/notes) | **Real** | `PATCH /api/mechanics/[id]` with audit logging |
| Call log | **Real** | `POST /api/mechanics/[id]/call-log` with audit |
| Audit viewer | **Real** | `/audit` page reads NDJSON / Netlify Blobs |
| Coverage / map | Stubbed | Pages exist, no GIS data |
| Follow-ups | Stubbed | Page exists, no scheduling |
| **Jobs intake** | **Missing entirely** | No jobs table, no API, no UI |

**Persistence:** Dual store — filesystem JSON in dev (`data/overrides.json`), Netlify Blobs in prod (`mechanic-overrides` store).

### C. `garage-pwa` — Garage owner dashboard

| Flow | Status | Notes |
|---|---|---|
| Job inbox (pending/active/done) | Real UI | Reads **hardcoded `SEED_JOBS`** |
| Job detail + status transitions | Real UI | All client-side, sessionStorage only |
| Accept / quote / complete | Real UI | Never syncs anywhere |
| Earnings | Real UI / **mock data** | No real payout backend |
| Login | **Fully fake** | Any 10-digit phone + any OTP (except `000000`) logs you in as "Imran K. — Khan Auto Detailing" |
| Profile | Stubbed | No persistence |

**Key file:** `apps/garage-pwa/src/lib/mock/jobs.ts` — `SEED_JOBS` array is the entire data source.

**Not deployed:** No `netlify.toml` in `apps/garage-pwa`.

---

## 2. Data Layer

| Data | Where it lives | Real? | Cross-app? |
|---|---|---|---|
| User bookings | `sessionStorage` (user-pwa) | ❌ | ❌ |
| Garage jobs | `sessionStorage` + seed (garage-pwa) | ❌ | ❌ |
| Mechanics list | `data/mechanics.json` (ops) | ✅ | ⚠️ read-only |
| Mechanic overrides | FS / Netlify Blobs (ops) | ✅ | ❌ |
| Audit log | NDJSON / Netlify Blobs (ops, user-pwa) | ✅ | partial |
| OTP store | `data/otp-store.json` (user-pwa) | ✅ | ❌ |
| Users / garages | `sessionStorage` | ❌ | ❌ |

**Critical issue:** `sessionStorage` is lost on page refresh. A user who books and refreshes loses their booking. There is **no real database** anywhere.

---

## 3. Authentication / Authorization

**Confirmed: real session auth is NOT implemented.** (CLAUDE.md itself admits this.)

| Layer | State |
|---|---|
| user-pwa login | Real OTP via WhatsApp, but session is `sessionStorage` only |
| garage-pwa login | Fully mocked (any OTP works) |
| ops | **No auth at all** — mechanics list is public |
| JWT / cookies | None |
| Role-based access | None |
| Server-side auth checks | None — `x-actor` header is trivially spoofable |
| `AUDIT_SECRET` | Gates `/api/audit` reads only |

---

## 4. Inter-App Connectivity

**The three apps do not talk to each other.**

- No HTTP calls between apps
- No shared database
- No shared types — `Job` (user-pwa) and `GarageJob` (garage-pwa) have different fields
- The only "link" is a Netlify CDN proxy: `mistr-waan.netlify.app/ops → waan-ops.netlify.app` (a static rewrite, **not a data bridge**)

A booking exists in three parallel universes, never shared.

---

## 5. Pipeline — Where It Breaks

End-to-end flow: **User books → ops sees it → ops assigns garage → garage accepts → garage completes → user notified.**

```
[1] User books in user-pwa
       ↓
       createJob() writes to sessionStorage
       ❌ NEVER LEAVES THE BROWSER
       ↓
[2] ops should see job
       ❌ no jobs table, no API, no intake
       ↓
[3] ops should assign garage
       ❌ no assignment API exists
       ↓
[4] garage-pwa should receive
       ❌ shows hardcoded SEED_JOBS instead
       ↓
[5] garage updates status
       ❌ writes to its own sessionStorage; never syncs
       ↓
[6] user sees update
       ❌ never happens — no notification, no poll, no push
```

**Step 1 is the first break.** Everything downstream is moot until bookings persist to a real backend.

---

## 6. Missing Core Features (Ranked)

### Tier 1 — Blocking launch

1. **Centralized database** — Supabase is the obvious fit; the MCP is already wired in this environment. Schema: `users`, `garages`, `mechanics`, `jobs`, `job_status_log`, `payments`, `notifications`.
2. **Real authentication** — JWT or signed cookies, server-validated sessions, roles (`user` / `garage` / `ops_admin`).
3. **`POST /api/jobs`** — booking persistence + audit entry.
4. **`GET /api/jobs`** for ops with filters (status, garage, date).
5. **`PATCH /api/jobs/:id`** — assignment + status transitions, with WhatsApp notification to garage.
6. **garage-pwa reads real jobs** — kill `SEED_JOBS`, fetch from the API.
7. **Status sync back to user-pwa** — polling is fine for v1.

### Tier 2 — Needed for a real product

8. **Razorpay** for UPI/card (mandatory for India market).
9. **Notifications** — WhatsApp templates ("booking confirmed", "garage assigned", "job complete"), FCM push for PWA, optional SMS fallback (Twilio/Infobip).
10. **Mechanic onboarding form + KYC** in ops (ID, address, bank, service selection).
11. **Real garage discovery / search** — replace `lib/mock/garages.ts`.
12. **Service catalog in DB** — admin-editable pricing.

### Tier 3 — Polish & safety

13. **Audit log backfill** — all job mutations, all garage-pwa mutations.
14. **Rate limiting** — booking spam, OTP abuse, scraping.
15. **Server-side input validation** everywhere (don't trust the client).
16. **Cancellation rules enforced server-side** (UI says "free until 1h before slot" — no enforcement exists).
17. **Real E2E tests** for the booking → assign → complete loop.
18. **Sentry / structured logging.**

### Tier 4 — Scale & operations

19. Caching (Redis) for mechanic list, garage search.
20. Backup strategy for Supabase.
21. GDPR / data-retention.
22. Analytics (Mixpanel / Segment).
23. Complete i18n (user-pwa is partially set up).
24. Support / ticketing.

---

## 7. Tests

| App | Unit tests | E2E |
|---|---|---|
| user-pwa | 12 files (strong OTP/WhatsApp coverage) | placeholder only |
| ops | 3 files (utility coverage only) | placeholder only |
| garage-pwa | 2 files (Button + utils) | placeholder only |

**Good coverage:** OTP send/verify, cooldown logic, WhatsApp client, audit logging in ops.

**No coverage:** booking creation, payments, job status transitions, mechanic patches in user-pwa, any garage-pwa flow, any inter-app journey (because there isn't one).

E2E specs exist but are skeletal — no real user journeys are tested.

---

## 8. Audit Logging — Mandate vs. Reality

CLAUDE.md mandates audit logs on every mutation.

| App | Coverage |
|---|---|
| ops | ✅ Full — `patch_mechanic`, `add_call_attempt`, `create_mechanic` |
| user-pwa | ⚠️ Partial — OTP send/verify logged; mechanic PATCH **not logged**; bookings would need it once they're real |
| garage-pwa | ❌ None (no real mutations exist yet) |

Backfill is needed when Tier 1 APIs land.

---

## 9. Build / Deploy

| App | Deployed | netlify.toml |
|---|---|---|
| user-pwa | ✅ `mistr-waan.netlify.app` | yes |
| ops | ✅ `waan-ops.netlify.app` | yes |
| garage-pwa | ❌ not deployed | **missing** |

**Required env vars** (not documented anywhere — should be):
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_SECRET` (user-pwa)
- `AUDIT_SECRET` (ops)
- `NETLIFY` (auto, switches FS ↔ Blobs)

---

## 10. Production-Readiness Scorecard

| Category | Score |
|---|---|
| Architecture | 2 / 10 |
| Data persistence | 2 / 10 |
| Authentication | 2 / 10 |
| API coverage | 3 / 10 |
| Testing | 4 / 10 |
| Audit & logging | 4 / 10 |
| Deployment | 5 / 10 |
| Notifications | 1 / 10 |
| Payments | 0 / 10 |
| Real-time / sync | 0 / 10 |
| Documentation | 3 / 10 |
| Error handling | 5 / 10 |
| **Overall** | **2.5 / 10** |

---

## 11. Open Questions for Review

These are decisions only you can make. Answers will shape the Tier 1 plan.

1. **Database choice** — Supabase (recommended, MCP already available) or self-hosted Postgres?
2. **Backend topology** — One shared API service that all three apps call, or per-app API routes hitting a shared DB?
3. **Auth provider** — Roll our own JWT, use Supabase Auth, or a third party (Clerk / Auth0)?
4. **Payment gateway** — Razorpay (India default) or also support Stripe for cards?
5. **Real-time sync** — Polling (simple, ships fast) or WebSockets / Supabase Realtime (better UX, more setup)?
6. **garage-pwa deployment** — should it ship now under a `waan-garage.netlify.app` subdomain, or stay internal until Tier 1 is done?
7. **Single garage identity model** — Is a "garage" the same entity as a "mechanic" in the ops list, or distinct? (Today they are different data shapes.)
8. **Ops user model** — Do ops staff log in individually (per-actor audit), or share an `ops_admin` account?
9. **Timeline** — Are you targeting a soft launch or pilot in weeks, or building toward a real launch over 2-3 months?
10. **Notification budget** — WhatsApp templates have per-message cost; is SMS fallback in scope or out?

---

*End of original audit. Reply inline with answers / corrections and we'll turn this into a concrete Tier 1 build plan.*

---

# Appendix A — Deployment & WhatsApp Setup Session (2026-05-21)

Operational log of the production setup that landed user-pwa at **autogtg.com** with the full WhatsApp Cloud API integration. Supersedes Section 9 ("Build / Deploy") above for the user-pwa app.

## A.1  Current live state

| | Value |
|---|---|
| **Live domain** | `https://autogtg.com` (Mistr Waan PWA, Next.js) |
| **Netlify site** | `mistr-waan-prod` |
| **Site ID** | `df1a79b8-c154-4d84-b0ab-c4f2d754a858` |
| **Account** | `autogtgofficials@gmail.com` (team `Autogtg`) |
| **Linked repo** | `autogtgofficials/mistr-waan` (private, branch `main`) |
| **SSR / functions** | Registered, serving traffic — webhook + login routes verified live |

### Other Netlify sites in play

| Site | Account | Status |
|---|---|---|
| `auto-gtg-prod` | autogtgofficials | Created, never deployed — was for the old Vite/Firebase homepage. Safe to delete. |
| `mistr-waan-app` | autogtgparent | Created, env vars set, never deployed. Safe to delete. |
| `polite-kitsune-df1123` | autogtgofficials | **Deleted** by user — was the old Vite auto-gtg deploy. |

### Source repos that have our code

| Repo | Use |
|---|---|
| `autogtgofficials/mistr-waan` | **Source of truth** — Netlify pulls from here |
| `autogtgparent-ai/mistr-waan` | Old mirror, unused |
| `FarhanSyedain/mistr-waan` | Original push, unused |

## A.2  WhatsApp Cloud API state

### Meta app
| | |
|---|---|
| App name | Autogtg |
| App ID | `1286834096913117` |
| App mode | **In development** (limited to 5 test recipients) |
| Owning business | Autogtg |

### WhatsApp Business Accounts

| WABA | ID | Current use |
|---|---|---|
| **Test WhatsApp Business Account** | `4594140190872984` | In env, used for all current dev/test traffic |
| **Autogtg** (production-ready) | `821235394080737` | Reserved for post-verification production switch |

### Test number (sandbox)
```
From:               +1 555 629-8588 (Meta-provided)
Phone Number ID:    1148761414982977
Quality rating:     GREEN
Daily tier:         TIER_250 (250 messages/day)
Allowed recipients: +91 7889686682 (verified)
```

### Verified working (live)
- ✅ `hello_world` template delivered to +91 7889686682 via Graph API
- ✅ Webhook GET endpoint at `https://autogtg.com/api/whatsapp/webhook` responds correctly (200 + echo on valid `hub.verify_token`, 403 otherwise)
- ✅ Function bundle registered (Netlify `plugin_state` flipped from `none` to working)

### Pending Meta actions

| Item | Status | Blocker |
|---|---|---|
| Business verification | ⏳ In review | Meta-side, 1–3 business days |
| Real phone number registration | ❌ | Business verification must clear first |
| Move from TIER_250 to higher tiers | ❌ | Same |
| `otp_login` template (Authentication) | ❌ Not submitted | Approval ~30 min once submitted; user-side action |
| `booking_confirmed` (Utility) | ❌ | Not needed pre-launch |
| `mechanic_assigned` (Utility) | ❌ | Not needed pre-launch |
| `job_complete` (Utility) | ❌ | Not needed pre-launch |
| Meta webhook URL configured | ❌ | Just needs you to paste `https://autogtg.com/api/whatsapp/webhook` + verify token `d6307d7466b8dd79728df185e24102a4` |

## A.3  Environment variables

### On Netlify (`mistr-waan-prod`)

| Variable | Notes |
|---|---|
| `WHATSAPP_PROVIDER` | `meta` |
| `WHATSAPP_APP_ID` | `1286834096913117` (public) |
| `WHATSAPP_ACCESS_TOKEN` | 24h temp token from Meta dev console — **must rotate to permanent System User token before going Live** |
| `WHATSAPP_PHONE_NUMBER_ID` | `1148761414982977` (test) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `4594140190872984` (test WABA) |
| `WHATSAPP_APP_SECRET` | Stored — also exposed in chat history; rotate before production |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Stored value: `string123`. **Live deploy still uses earlier value** `d6307d7466b8dd79728df185e24102a4` — Netlify bakes env vars at build time; will not switch until next successful rebuild |

### Locally
- `apps/user-pwa/.env.local` — full set, gitignored, source of truth for local dev
- `apps/user-pwa/.env.local.example` — committed template with placeholder values

## A.4  Known build-system issues

### Publish-dir resolution
With `package_path = apps/user-pwa` and `base = ""`, Netlify resolves `publish = ".next"` from `netlify.toml` relative to the **repo root** (`/opt/build/repo/.next`) instead of the package path (`/opt/build/repo/apps/user-pwa/.next`). The currently-live deploy worked because of a different setting at the time; subsequent rebuilds have been failing on this. To fix permanently, either:
- Edit `apps/user-pwa/netlify.toml` → `publish = "apps/user-pwa/.next"`, OR
- Set Base directory to `apps/user-pwa` in the Netlify dashboard (UI-only change — `netlify api updateSite` silently ignores build_settings updates for Git-linked sites; verified 5 different payload shapes).

### CLI deploys break SSR
`netlify deploy --build` for Next.js + `@netlify/plugin-nextjs` v5.15.11 uploads files but does **not** register the SSR function (we saw `plugin_state: none` and 0 functions deployed; all routes 404). **Only Git-linked builds work.** Don't try to bypass GitHub.

### Local network / LibreSSL
User's machine intermittently fails sustained HTTPS uploads (`bad record mac` to GitHub, `inflate data check` server-side). Resolves itself or with Cloudflare WARP. Symptoms: small operations succeed, bulk push or `netlify deploy --build` mid-uploads corrupt the stream.

## A.5  Outstanding work — prioritized

🔴 **Hard blockers for real customer traffic**

1. **Rotate `WHATSAPP_ACCESS_TOKEN`** to a permanent System User token. Current token rotates every 24h.
2. **Complete Meta business verification.** Out of our hands; check status at Business Settings → Security Center.
3. **Switch to production WABA** (`821235394080737`) with a real phone number once verification clears.

🟡 **Pre-launch checklist**

4. Submit `otp_login` template in Meta WhatsApp Manager (auth, ~30 min auto-approve).
5. Configure Meta webhook URL with token `d6307d7466b8dd79728df185e24102a4` (current live value).
6. Fix the publish-dir issue so future deploys are reliable (one-field dashboard change OR `netlify.toml` edit).
7. After the next successful deploy, update Meta webhook to `string123` (or whatever value is live by then).

🟢 **Cleanup**

8. Delete unused Netlify sites (`mistr-waan-app` in autogtgparent, `auto-gtg-prod` if not used).
9. Delete unused GitHub mirrors (`autogtgparent-ai/mistr-waan`, `FarhanSyedain/mistr-waan` if private mirror not needed).
10. Submit the remaining utility templates (`booking_confirmed`, `mechanic_assigned`, `job_complete`) — only after business verification clears and only when the booking flow is actually ready.

## A.6  Useful commands

```bash
# From repo root or any subdirectory
netlify status                            # check current Netlify account + linked site
netlify api listSites
netlify api getSite --data '{"site_id":"df1a79b8-c154-4d84-b0ab-c4f2d754a858"}'

# Trigger a Netlify build
netlify api createSiteBuild --data '{"site_id":"df1a79b8-c154-4d84-b0ab-c4f2d754a858"}'

# Smoke-test live endpoints
curl -s -o /dev/null -w "%{http_code}\n" https://autogtg.com/
curl "https://autogtg.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=d6307d7466b8dd79728df185e24102a4&hub.challenge=ping"

# Send a real WhatsApp template message (test number → allow-listed recipient)
set -a; source apps/user-pwa/.env.local; set +a
curl -X POST "https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"917889686682","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'

# Run the WhatsApp + OTP test suite
cd apps/user-pwa && pnpm test
```

## A.7  Recovery / continuity notes

If picking this up cold without prior context:

1. **The live site is `https://autogtg.com`.** Confirm: `curl https://autogtg.com/` returns 200 with HTML title "Mister Waan".
2. **Netlify is at `autogtgofficials@gmail.com`**, team `Autogtg`. Don't log in to `autogtgparent@gmail.com` — that's an abandoned account.
3. **GitHub source is `autogtgofficials/mistr-waan` (private).** Other mirrors exist but are stale.
4. **WhatsApp test recipient is `+91 7889686682`** — must be added in Meta API Setup → "To" list before any sends.
5. **Permissions for Meta**: Business Manager (`business.facebook.com`) is for people/permissions; WhatsApp Manager (`business.facebook.com/wa/manage/`) is for templates/phone numbers — common confusion point.
6. **Test number is `+1 555 629-8588`**; it's shared across Meta dev tenants, has GREEN quality, and delivers to verified recipients only.
7. **CLAUDE.md and apps/user-pwa/AGENTS.md** spell out repo conventions for future agents — read first.

## A.8  Score updates vs. original audit

Original audit predates this deployment work. Reassessed where relevant:

| Category | Original | Updated | Delta |
|---|---|---|---|
| Deployment | 5 / 10 | **7 / 10** | +2 — site is live with SSR, custom domain, env vars wired |
| Notifications | 1 / 10 | **3 / 10** | +2 — Cloud API integrated and verified end-to-end; templates still pending |
| Documentation | 3 / 10 | **5 / 10** | +2 — this appendix |
| Authentication | 2 / 10 | 2 / 10 | unchanged — server-validated sessions still not implemented |

All other categories from the original audit are unchanged. **Overall still ~3 / 10 (early prototype)** — deployment is now solid, but the data-layer and inter-app gaps from the original audit remain.

---

*End of Appendix A.*
