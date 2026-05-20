import { describe, it, expect } from "vitest";
import { parseInboundMessages } from "./client";

describe("parseInboundMessages", () => {
  it("extracts a single text message", () => {
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
                    timestamp: "1716200000",
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
    const result = parseInboundMessages(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: "919876543210",
      messageId: "wamid.ABC",
      type: "text",
      text: "hi",
    });
  });

  it("extracts an interactive button reply", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.XYZ",
                    timestamp: "1716200000",
                    type: "interactive",
                    interactive: { button_reply: { id: "book_now" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = parseInboundMessages(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "interactive",
      interactiveId: "book_now",
    });
  });

  it("returns [] for a status callback payload (no messages array)", () => {
    const payload = {
      entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }],
    };
    expect(parseInboundMessages(payload)).toEqual([]);
  });

  it("returns [] for malformed input", () => {
    expect(parseInboundMessages(null)).toEqual([]);
    expect(parseInboundMessages({})).toEqual([]);
    expect(parseInboundMessages({ entry: [{}] })).toEqual([]);
  });

  it("skips messages missing from/id", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { type: "text", text: { body: "no-from" } },
                  { from: "x", id: "y", type: "text", text: { body: "ok" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseInboundMessages(payload)).toHaveLength(1);
  });
});
