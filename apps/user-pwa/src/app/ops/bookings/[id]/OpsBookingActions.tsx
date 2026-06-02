"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingStatus } from "@/lib/bookings/types";
import type { BookingNote } from "@/lib/bookings/notes";

/**
 * Right-rail actions for an ops booking detail: set/adjust quote, assign
 * garage, jot notes. Each form posts to its API route and refreshes the
 * server component on success.
 *
 * No optimistic UI — these are low-traffic moves where a 1-2s round-trip is
 * fine, and we'd rather show the canonical server state than risk drift.
 */

export function OpsBookingActions(props: {
  bookingId: string;
  shortId: string;
  currentStatus: BookingStatus;
  currentTotal: number | null;
  currentGarageId: string | null;
  garageOptions: { id: string; label: string }[];
  initialNotes: BookingNote[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Quote form
  const [quoteAmount, setQuoteAmount] = useState(
    props.currentTotal != null ? String(props.currentTotal) : "",
  );
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Assign form
  const [garageId, setGarageId] = useState(props.currentGarageId ?? "");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Notes
  const [noteBody, setNoteBody] = useState("");
  const [notes, setNotes] = useState<BookingNote[]>(props.initialNotes);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Request photos via WhatsApp
  const [photoReqBusy, setPhotoReqBusy] = useState(false);
  const [photoReqMsg, setPhotoReqMsg] = useState<string | null>(null);
  const [photoReqError, setPhotoReqError] = useState<string | null>(null);

  const canQuote =
    props.currentStatus === "queued_for_call" ||
    props.currentStatus === "quoted" ||
    props.currentStatus === "awaiting_garage" ||
    props.currentStatus === "declined_by_garage";
  const canAssign =
    props.currentStatus === "quoted" ||
    props.currentStatus === "awaiting_garage" ||
    props.currentStatus === "declined_by_garage";

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    setQuoteBusy(true);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/ops/bookings/${props.bookingId}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(quoteAmount),
          note: quoteNote || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setQuoteNote("");
      startTransition(() => router.refresh());
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "failed");
    } finally {
      setQuoteBusy(false);
    }
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!garageId) return;
    setAssignBusy(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/ops/bookings/${props.bookingId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garageId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "failed");
    } finally {
      setAssignBusy(false);
    }
  }

  async function requestPhotos() {
    setPhotoReqBusy(true);
    setPhotoReqMsg(null);
    setPhotoReqError(null);
    try {
      const res = await fetch(
        `/api/ops/bookings/${props.bookingId}/request-photos`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        sent?: boolean;
        notificationOutcome?: string;
        error?: string;
      };
      if (!res.ok || !data.sent) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setPhotoReqMsg(
        data.notificationOutcome === "sent"
          ? "✓ Sent. Customer can now send photos in this WhatsApp thread (next 24h)."
          : "✓ Saved, but WhatsApp send failed — check the outbox.",
      );
    } catch (err) {
      setPhotoReqError(err instanceof Error ? err.message : "failed");
    } finally {
      setPhotoReqBusy(false);
    }
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    const body = noteBody.trim();
    if (!body) return;
    setNoteBusy(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/ops/bookings/${props.bookingId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as { note?: BookingNote; error?: string };
      if (!res.ok || !data.note) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotes((prev) => [data.note!, ...prev]);
      setNoteBody("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "failed");
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Set quote</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends `booking_quoted` WhatsApp to the customer.
        </p>
        <form onSubmit={submitQuote} className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Amount (₹)</span>
            <input
              type="number"
              min={0}
              step={1}
              required
              disabled={!canQuote}
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm tabular disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Internal note (optional)</span>
            <input
              type="text"
              maxLength={200}
              disabled={!canQuote}
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            />
          </label>
          {quoteError && <p className="text-xs text-ignite-700">{quoteError}</p>}
          <button
            type="submit"
            disabled={!canQuote || quoteBusy}
            className="h-9 w-full rounded-md bg-pulse-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {quoteBusy ? "Saving…" : "Save quote"}
          </button>
        </form>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Assign garage</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends `garage_new_job` WhatsApp with Accept / Decline buttons.
        </p>
        <form onSubmit={submitAssign} className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Garage</span>
            <select
              required
              disabled={!canAssign}
              value={garageId}
              onChange={(e) => setGarageId(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">Choose a garage…</option>
              {props.garageOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          {assignError && <p className="text-xs text-ignite-700">{assignError}</p>}
          <button
            type="submit"
            disabled={!canAssign || assignBusy || !garageId}
            className="h-9 w-full rounded-md bg-pulse-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {assignBusy ? "Assigning…" : "Assign + notify"}
          </button>
        </form>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Request photos via WhatsApp</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends the customer a WA prompt. Any photos they reply with (next 24h, up to 8)
          attach to this booking automatically.
        </p>
        <button
          type="button"
          onClick={() => void requestPhotos()}
          disabled={photoReqBusy}
          className="mt-3 h-9 w-full rounded-md border border-border-subtle bg-card text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {photoReqBusy ? "Sending…" : "Request photos"}
        </button>
        {photoReqMsg && (
          <p className="mt-2 text-xs text-aqua-700">{photoReqMsg}</p>
        )}
        {photoReqError && (
          <p className="mt-2 text-xs text-ignite-700">{photoReqError}</p>
        )}
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Notes</h3>
        <form onSubmit={submitNote} className="mt-3 space-y-2">
          <textarea
            rows={3}
            maxLength={4000}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Called customer, no answer…"
            className="block w-full rounded-md border border-input bg-background p-2 text-sm"
          />
          {noteError && <p className="text-xs text-ignite-700">{noteError}</p>}
          <button
            type="submit"
            disabled={noteBusy || noteBody.trim().length === 0}
            className="h-8 px-3 rounded-md border border-border-subtle text-xs text-foreground hover:bg-muted disabled:opacity-50"
          >
            {noteBusy ? "Saving…" : "Add note"}
          </button>
        </form>
        {notes.length > 0 && (
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-t border-border-subtle pt-3 first:border-0 first:pt-0">
                <div className="text-xs text-muted-foreground tabular">
                  {n.author} · {new Date(n.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-foreground whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
