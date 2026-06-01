# Mistr Waan — Env vars checklist (Week 1)

Set these in **two places** for every variable:

1. **Local dev** → `apps/user-pwa/.env.local` (gitignored)
2. **Production** → Netlify dashboard for the `mistr-waan-prod` site at autogtg.com
   → https://app.netlify.com/projects/mistr-waan-prod/configuration/env

Both lists are the **same names + same values** unless noted.

---

## Already set (from earlier work — don't touch)

```
WHATSAPP_PROVIDER=meta
WHATSAPP_APP_ID=1286834096913117
WHATSAPP_ACCESS_TOKEN=<existing>
WHATSAPP_PHONE_NUMBER_ID=1148761414982977
WHATSAPP_BUSINESS_ACCOUNT_ID=4594140190872984
WHATSAPP_APP_SECRET=<existing>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=string123     # remember: live still on the older value until next deploy
```

---

## NEW — please add these now

### Supabase (project `mistr-waan-prod`, id `cftqffmoxsynxzaqfyin`)

```
NEXT_PUBLIC_SUPABASE_URL=https://cftqffmoxsynxzaqfyin.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdHFmZm1veHN5bnh6YXFmeWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNTU0MDIsImV4cCI6MjA5NDkzMTQwMn0.leNW6Huwq2Jo8JsR0T7Yonrhkxwvz2ibBfryPr-FHQw

SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard — see below>
```

⚠️ **`SUPABASE_SERVICE_ROLE_KEY` is the one I need from you.** I can't fetch it via API for safety. Steps:

1. Open https://app.supabase.com/project/cftqffmoxsynxzaqfyin/settings/api
2. Scroll to **"Project API keys"**
3. Find **`service_role`** (NOT `anon`). Click the eye icon → copy the long JWT string.
4. Paste into both `.env.local` and the Netlify env var.

This key bypasses RLS — never expose it client-side, never commit it.

### JWT for our custom sessions (customer / garage / ops cookies)

```
JWT_SECRET=c3cbff710b66e33d4356f2f8214dd9fbea3af20848cf5467e4cd9dd6303ed0ddd9a24fad05a2c45f38fe8c001d45e7c8
```

96-char hex string I just generated. Or replace with your own (anything 32+ chars random is fine). Same value in both env files.

### Ops shared password (Week 1 ops login)

```
OPS_SHARED_PASSWORD=4j2LsaMqGgBGdtzdk3C6Lw
```

Suggested value above; override with anything you'll remember. This logs you into `ops.autogtg.com`. You'll later invite per-user seats from inside ops, but this gets us in for week 1.

### App env (used by Razorpay redirect URLs + WhatsApp template button URLs)

```
NEXT_PUBLIC_APP_ORIGIN=https://autogtg.com
```

For local dev, set to `http://localhost:3000` in `.env.local`.

### Support phone (the call-first "Call to confirm" button)

```
NEXT_PUBLIC_SUPPORT_PHONE=+917889686682
```

The customer-facing booking pages (`/book`, `/maintenance`, `/rsa`) show a
"Call to confirm" button that dials this number. Set it to the human line ops
answers. Customers browse with no login; ops creates the booking from the
call via `/ops/bookings/new`.

---

## Coming in week 3 (don't set yet — placeholders only)

```
RAZORPAY_KEY_ID=                          # rzp_test_... while in test mode
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_ENABLED=false        # flip to true when live keys arrive
NEXT_PUBLIC_RAZORPAY_KEY_ID=              # same as RAZORPAY_KEY_ID; used by Checkout
```

---

## After adding — verify

Run locally to sanity-check the local set:

```bash
cd /Users/waan/AutoGTG/Waan/apps/user-pwa
cat .env.local | grep -E "^(SUPABASE_|JWT_SECRET|OPS_|NEXT_PUBLIC_)" | wc -l
# expect: 5
```

On Netlify, after pasting:

```bash
netlify env:list --plain | grep -E "(SUPABASE|JWT_SECRET|OPS_SHARED)" | wc -l
# expect: 5
```
