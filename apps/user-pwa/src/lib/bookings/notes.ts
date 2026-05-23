import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Notes attached to a booking by ops or (later) the assigned garage.
 * Free-text "called customer, no answer", "customer wants Sunday morning", etc.
 *
 * Schema lives in supabase/migrations/0002_booking_notes_and_storage.sql.
 * Until the migration is applied and types are regenerated, we cast to the
 * known shape — this is the only file that does so, so the cast is contained.
 */

export interface BookingNote {
  id: string;
  bookingId: string;
  author: string;
  body: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  booking_id: string;
  author: string;
  body: string;
  created_at: string;
}

function fromRow(row: NoteRow): BookingNote {
  return {
    id: row.id,
    bookingId: row.booking_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function addBookingNote(opts: {
  bookingId: string;
  author: string;
  body: string;
}): Promise<BookingNote> {
  const body = opts.body.trim();
  if (body.length === 0 || body.length > 4000) {
    throw new Error("note body must be 1–4000 characters");
  }
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("booking_notes")
    .insert({
      booking_id: opts.bookingId,
      author: opts.author,
      body,
    })
    .select("*")
    .single();
  if (error) throw new Error(`booking_note insert failed: ${error.message}`);
  return fromRow(data as NoteRow);
}

export async function listBookingNotes(bookingId: string): Promise<BookingNote[]> {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("booking_notes")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`booking_notes list failed: ${error.message}`);
  return ((data as NoteRow[]) ?? []).map(fromRow);
}
