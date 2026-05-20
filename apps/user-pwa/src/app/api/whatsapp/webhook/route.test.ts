import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { GET, POST } from "./route";
import { appendAuditEntry } from "@/lib/audit/log";

const auditMock = vi.mocked(appendAuditEntry);

const VERIFY_TOKEN = "verify-token-fixture";
const APP_SECRET = "app-secret-fixture";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");
}

beforeEach(() => {
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.WHATSAPP_APP_SECRET = APP_SECRET;
  auditMock.mockReset();
});

afterEach(() => {
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  delete process.env.WHATSAPP_APP_SECRET;
});

describe("GET /api/whatsapp/webhook", () => {
  it("echoes the challenge when token + mode match", async () => {
    const url = `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("12345");
  });

  it("403s on a wrong verify token", async () => {
    const url = `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
  });

  it("403s when mode is not subscribe", async () => {
    const url = `http://localhost/api/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/whatsapp/webhook", () => {
  function postReq(body: string, signature: string | null): Request {
    return new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-hub-signature-256": signature } : {}),
      },
      body,
    });
  }

  it("401s when the signature header is missing", async () => {
    const body = JSON.stringify({ entry: [] });
    const res = await POST(postReq(body, null));
    expect(res.status).toBe(401);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error", error: "invalid_signature" }),
    );
  });

  it("401s when the signature does not match", async () => {
    const body = JSON.stringify({ entry: [] });
    const res = await POST(postReq(body, sign("different body")));
    expect(res.status).toBe(401);
  });

  it("accepts a valid signature and audits each inbound message", async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.ABC",
                    type: "text",
                    text: { body: "hi" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    const res = await POST(postReq(body, sign(body)));
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "whatsapp_inbound",
        entityId: "wamid.ABC",
        actor: "919876543210",
        outcome: "success",
      }),
    );
  });

  it("400s when the body is not valid JSON even with a matching signature", async () => {
    const body = "not-json";
    const res = await POST(postReq(body, sign(body)));
    expect(res.status).toBe(400);
  });
});
