import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppOtp: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { sendWhatsAppOtp } from "@/lib/whatsapp/client";
import { appendAuditEntry } from "@/lib/audit/log";
import { WhatsAppError } from "@/lib/whatsapp/types";
import { clearOtp } from "@/lib/otp/store";

const sendMock = vi.mocked(sendWhatsAppOtp);
const auditMock = vi.mocked(appendAuditEntry);

let originalCwd: string;
let tmp: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), "otp-send-"));
  process.chdir(tmp);
  delete process.env.NETLIFY;
  sendMock.mockReset();
  auditMock.mockReset();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tmp, { recursive: true, force: true });
  await clearOtp("+916006617842").catch(() => undefined);
});

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/auth/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp/send", () => {
  it("400s on an invalid phone and audits the failure", async () => {
    const res = await POST(postReq({ phone: "12345" }));
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "send_otp", outcome: "error", error: "invalid_phone" }),
    );
  });

  it("501s when the requested channel is not wired", async () => {
    const res = await POST(postReq({ phone: "6006617842", channel: "sms" }));
    expect(res.status).toBe(501);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends an OTP, audits success, and returns expiresAt", async () => {
    sendMock.mockResolvedValueOnce({ messageId: "wamid.MOCK", provider: "meta" });
    const res = await POST(postReq({ phone: "6006617842" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { sent: boolean; expiresAt: number };
    expect(data.sent).toBe(true);
    expect(data.expiresAt).toBeGreaterThan(Date.now());
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+916006617842", code: expect.stringMatching(/^\d{6}$/) }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "send_otp", outcome: "success" }),
    );
  });

  it("429s when re-requested inside the cooldown window", async () => {
    sendMock.mockResolvedValue({ messageId: "wamid.MOCK", provider: "meta" });
    await POST(postReq({ phone: "6006617842" }));
    const second = await POST(postReq({ phone: "6006617842" }));
    expect(second.status).toBe(429);
    const body = (await second.json()) as { error: string; retryAfterMs: number };
    expect(body.error).toBe("cooldown");
    expect(body.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns the provider status code when Meta rejects", async () => {
    sendMock.mockRejectedValueOnce(
      new WhatsAppError("template not approved", "131_026", 400),
    );
    const res = await POST(postReq({ phone: "7006617842" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail: string };
    expect(body.error).toBe("send_failed");
    expect(body.detail).toBe("131_026");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "send_otp", outcome: "error" }),
    );
  });

  it("502s on a non-WhatsAppError failure", async () => {
    sendMock.mockRejectedValueOnce(new Error("network down"));
    const res = await POST(postReq({ phone: "8006617842" }));
    expect(res.status).toBe(502);
  });
});
