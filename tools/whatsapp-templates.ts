#!/usr/bin/env tsx
/**
 * Create / list / delete WhatsApp message templates via the Graph API.
 *
 * Reads from apps/user-pwa/.env.local (WHATSAPP_ACCESS_TOKEN +
 * WHATSAPP_BUSINESS_ACCOUNT_ID). The token must have the
 * `whatsapp_business_management` permission — sending uses
 * `whatsapp_business_messaging` which is different.
 *
 * Usage:
 *   pnpm tsx tools/whatsapp-templates.ts list
 *   pnpm tsx tools/whatsapp-templates.ts create <name>     # see TEMPLATES below
 *   pnpm tsx tools/whatsapp-templates.ts create-all
 *   pnpm tsx tools/whatsapp-templates.ts delete <name>
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../apps/user-pwa/.env.local");

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(ENV_PATH, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.error(`[envload] couldn't read ${ENV_PATH}:`, e);
    process.exit(1);
  }
  return out;
}

const env = loadEnv();
const TOKEN = env.WHATSAPP_ACCESS_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID =
  env.WHATSAPP_BUSINESS_ACCOUNT_ID ??
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ??
  "821235394080737"; // Autogtg WABA from the dashboard screenshot
const GRAPH = "https://graph.facebook.com/v23.0";

if (!TOKEN) {
  console.error("WHATSAPP_ACCESS_TOKEN missing in env.");
  process.exit(1);
}

/** Each template definition mirrors what we send at runtime in
 *  apps/user-pwa/src/lib/whatsapp/templates.ts. Body var positions
 *  ({{1}}, {{2}}, ...) must match the runtime call sites. */

interface TemplateDef {
  name: string;
  category: "AUTHENTICATION" | "UTILITY" | "MARKETING";
  language: string;
  /** Example values for each {{n}}, used by Meta to evaluate the template. */
  bodyExamples: string[];
  /** Body with {{1}}, {{2}}, ... placeholders. Ignored for AUTHENTICATION. */
  body: string;
  /** Optional quick-reply or URL buttons. */
  buttons?: Button[];
  /** AUTHENTICATION-only: minutes until the code expires. */
  codeExpirationMinutes?: number;
}

type Button =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] };

const TEMPLATES: TemplateDef[] = [
  {
    // Submitted as UTILITY because the Autogtg WABA isn't enrolled in Meta's
    // "Authentication Solutions" program (which would give us the dedicated
    // OTP copy-chip UI). UTILITY works for OTP delivery — the code sits in
    // the body and the user copies it manually. Switch to AUTHENTICATION
    // category later via:
    //   business.facebook.com/business/wa/manage/message-templates/ → Settings
    name: "otp_login",
    category: "UTILITY",
    language: "en",
    body:
      "Your Mistr Waan login code is *{{1}}*. Valid for 5 minutes. " +
      "Do not share this code with anyone.",
    bodyExamples: ["123456"],
  },
  {
    name: "booking_confirmed",
    category: "UTILITY",
    language: "en",
    body:
      "Hi! Your Mistr Waan booking *{{1}}* is received. " +
      "Slot: {{2}}. Estimated total: ₹{{3}}.\n\nWe'll call you in a few minutes to confirm details.",
    bodyExamples: ["MW-AB23CD", "Tomorrow 10 AM", "500"],
  },
  {
    name: "booking_quoted",
    category: "UTILITY",
    language: "en",
    body:
      "Hi! Your Mistr Waan booking *{{1}}* has been quoted at *{{2}}*.\n\n" +
      "Payment mode: {{3}}.\n\nWe'll assign a garage shortly.",
    bodyExamples: ["MW-AB23CD", "₹3200", "Cash on visit"],
  },
  {
    name: "garage_new_job",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, you have a new job from Mistr Waan:\n\n" +
      "Customer: {{2}}\nService: {{3}}\nSlot: {{4}}\n\n" +
      "Tap Accept to confirm or Decline to pass.",
    bodyExamples: ["Imran", "Aaliyah", "Foam wash", "Tomorrow 10 AM"],
    buttons: [
      { type: "QUICK_REPLY", text: "Accept" },
      { type: "QUICK_REPLY", text: "Decline" },
    ],
  },
  {
    name: "mechanic_assigned",
    category: "UTILITY",
    language: "en",
    body:
      "Good news! Your Mistr Waan booking *{{2}}* has been assigned to *{{1}}*.\n\n" +
      "They'll WhatsApp you when work starts.",
    bodyExamples: ["Imran's Auto", "MW-AB23CD"],
  },
  {
    name: "garage_declined",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, the garage we tried for booking *{{2}}* wasn't able to take it.\n\n" +
      "No worries — our team is finding you another garage. You'll hear back in a few minutes.",
    bodyExamples: ["Aaliyah", "MW-AB23CD"],
  },
  {
    name: "job_started",
    category: "UTILITY",
    language: "en",
    body: "Hi {{1}}, work has started on your Mistr Waan booking *{{2}}*. 🛠️\n\nWe'll ping you when it's done.",
    bodyExamples: ["Aaliyah", "MW-AB23CD"],
  },
  {
    name: "job_complete",
    category: "UTILITY",
    language: "en",
    body:
      "Your Mistr Waan booking *{{1}}* is complete! 🎉\n\n" +
      "View details, pay (if cash), and rate your experience at autogtg.com/bookings/{{1}} — thanks for choosing us.",
    bodyExamples: ["MW-AB23CD"],
  },
  {
    name: "booking_cancelled",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, your Mistr Waan booking *{{2}}* has been cancelled.\n\n" +
      "If you cancelled by mistake or want to rebook, just visit autogtg.com.",
    bodyExamples: ["Aaliyah", "MW-AB23CD"],
  },
  {
    name: "referral_reward",
    category: "MARKETING",
    language: "en",
    body:
      "🎁 Good news {{1}}! Your friend just completed their first Mistr Waan booking — " +
      "you've earned {{2}} loyalty points.\n\nPoints apply automatically at your next checkout.",
    bodyExamples: ["Aaliyah", "200"],
  },
  // ── Phase 5: blueprint alignment ─────────────────────────────────────────
  {
    name: "mechanic_onboarding_submitted",
    category: "UTILITY",
    language: "en",
    body:
      "Thanks {{1}}! Your workshop *{{2}}* has been submitted to Mistr Waan for verification.\n\n" +
      "Our team will review your details and activate your partner profile within 24 hours. " +
      "We'll WhatsApp you once you're live.",
    bodyExamples: ["Imran", "Khan Auto Detailing"],
  },
  {
    name: "mechanic_activated",
    category: "UTILITY",
    language: "en",
    body:
      "Great news {{1}}! Your workshop *{{2}}* is now live on Mistr Waan. " +
      "You'll start receiving job requests on this number.\n\n" +
      "Reply JOBS to see your active queue, HELP for all commands.",
    bodyExamples: ["Imran", "Khan Auto Detailing"],
  },
  {
    name: "mechanic_rejected",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, we couldn't verify your Mistr Waan workshop application.\n\n" +
      "Reason: {{2}}\n\nPlease reply ONBOARD to try again, or message our team for help.",
    bodyExamples: ["Imran", "Verification document was unclear"],
  },
  {
    name: "request_photos",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, please send a few clear photos of the issue so our team can quote your " +
      "booking *{{2}}* accurately.\n\nSend up to 8 photos in this chat, then reply DONE.",
    bodyExamples: ["Aaliyah", "MW-AB23CD"],
  },
  {
    name: "rsa_acknowledged",
    category: "UTILITY",
    language: "en",
    body:
      "Hi {{1}}, your roadside assistance request *{{2}}* is received. " +
      "Our team is calling you right now to dispatch the nearest mechanic.",
    bodyExamples: ["Aaliyah", "MW-AB23CD"],
  },
];

function findTemplate(name: string): TemplateDef {
  const t = TEMPLATES.find((x) => x.name === name);
  if (!t) {
    console.error(`Unknown template '${name}'. Known:`, TEMPLATES.map((t) => t.name).join(", "));
    process.exit(1);
  }
  return t;
}

function templatePayload(t: TemplateDef): Record<string, unknown> {
  // AUTHENTICATION templates have a fully fixed schema — Meta supplies the
  // body text; we only declare add_security_recommendation, code expiration,
  // and the mandatory OTP COPY_CODE button.
  if (t.category === "AUTHENTICATION") {
    return {
      name: t.name,
      language: t.language,
      category: t.category,
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: t.codeExpirationMinutes ?? 5 },
        {
          type: "BUTTONS",
          buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }],
        },
      ],
    };
  }
  const components: Record<string, unknown>[] = [
    {
      type: "BODY",
      text: t.body,
      example: { body_text: [t.bodyExamples] },
    },
  ];
  if (t.buttons && t.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) => {
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
        return {
          type: "URL",
          text: b.text,
          url: b.url,
          ...(b.example ? { example: b.example } : {}),
        };
      }),
    });
  }
  return {
    name: t.name,
    language: t.language,
    category: t.category,
    components,
  };
}

async function listTemplates() {
  const res = await fetch(
    `${GRAPH}/${WABA_ID}/message_templates?limit=100&fields=name,status,language,category,quality_score,rejected_reason`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const data = (await res.json()) as {
    data?: { name: string; status: string; language: string; category: string; rejected_reason?: string }[];
    error?: { message: string };
  };
  if (!res.ok) {
    console.error("[list] failed", res.status, data.error?.message ?? data);
    process.exit(2);
  }
  const rows = data.data ?? [];
  if (rows.length === 0) {
    console.log("(no templates yet)");
    return;
  }
  console.log(`${rows.length} template(s) on WABA ${WABA_ID}:\n`);
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(22)} ${r.status.padEnd(10)} ${r.category.padEnd(15)} ${r.language}${r.rejected_reason ? "  (" + r.rejected_reason + ")" : ""}`,
    );
  }
}

async function createOne(name: string) {
  const t = findTemplate(name);
  const body = templatePayload(t);
  console.log(`Creating ${t.name}…`);
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { id?: string; status?: string; error?: { message: string; error_user_msg?: string } };
  if (!res.ok) {
    console.error(`  ✗ ${name}: ${res.status} ${data.error?.error_user_msg ?? data.error?.message ?? JSON.stringify(data)}`);
    return false;
  }
  console.log(`  ✓ ${name}: id=${data.id} status=${data.status ?? "submitted"}`);
  return true;
}

async function createAll() {
  let ok = 0;
  for (const t of TEMPLATES) {
    if (await createOne(t.name)) ok++;
  }
  console.log(`\nDone: ${ok}/${TEMPLATES.length} submitted.`);
}

async function deleteOne(name: string) {
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  console.log(res.ok ? `✓ deleted ${name}` : `✗ delete failed:`, data);
}

const [cmd, arg] = process.argv.slice(2);
const main =
  cmd === "list"
    ? listTemplates
    : cmd === "create"
      ? () => createOne(arg!)
      : cmd === "create-all"
        ? createAll
        : cmd === "delete"
          ? () => deleteOne(arg!)
          : () => {
              console.log(
                "Usage:\n" +
                  "  pnpm tsx tools/whatsapp-templates.ts list\n" +
                  "  pnpm tsx tools/whatsapp-templates.ts create <name>\n" +
                  "  pnpm tsx tools/whatsapp-templates.ts create-all\n" +
                  "  pnpm tsx tools/whatsapp-templates.ts delete <name>\n\n" +
                  "Known templates:\n  " +
                  TEMPLATES.map((t) => t.name).join("\n  "),
              );
              process.exit(0);
            };

void main().catch((err) => {
  console.error("[crash]", err);
  process.exit(1);
});
