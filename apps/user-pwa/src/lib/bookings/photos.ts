import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Booking photos live in the private `booking-photos` Storage bucket under
 * `<bookingId>/<uuid>.<ext>`. We never expose the bucket publicly — every
 * read mints a short-lived signed URL.
 */

export const BUCKET = "booking-photos";

/** Mime → file extension. Bucket also enforces this list at the platform level. */
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export interface BookingPhoto {
  id: string;
  bookingId: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}

interface PhotoRow {
  id: string;
  booking_id: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

function fromRow(row: PhotoRow): BookingPhoto {
  return {
    id: row.id,
    bookingId: row.booking_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

export interface UploadBookingPhotoInput {
  bookingId: string;
  bytes: ArrayBuffer | Uint8Array;
  mimeType: string;
}

export async function uploadBookingPhoto(
  input: UploadBookingPhotoInput,
): Promise<BookingPhoto> {
  const ext = ALLOWED_MIME[input.mimeType.toLowerCase()];
  if (!ext) {
    throw new Error(
      `unsupported_mime: ${input.mimeType} (allowed: ${Object.keys(ALLOWED_MIME).join(", ")})`,
    );
  }

  const bytes =
    input.bytes instanceof Uint8Array
      ? input.bytes
      : new Uint8Array(input.bytes);
  if (bytes.byteLength === 0) throw new Error("empty_file");
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`file_too_large: ${bytes.byteLength} > ${MAX_BYTES}`);
  }

  const supabase = getSupabaseAdmin();
  const path = `${input.bookingId}/${randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: input.mimeType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`);

  const { data, error: insertErr } = await supabase
    .from("booking_photos")
    .insert({
      booking_id: input.bookingId,
      storage_path: path,
      mime_type: input.mimeType,
      size_bytes: bytes.byteLength,
    })
    .select("*")
    .single();
  if (insertErr) {
    // Try to clean up the orphaned blob so we don't leak storage.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw new Error(`booking_photo insert failed: ${insertErr.message}`);
  }
  return fromRow(data as PhotoRow);
}

export async function listBookingPhotos(bookingId: string): Promise<BookingPhoto[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_photos")
    .select("*")
    .eq("booking_id", bookingId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(`booking_photos list failed: ${error.message}`);
  return ((data as PhotoRow[]) ?? []).map(fromRow);
}

/** Mint short-lived signed URLs for a set of photo rows. Default 5 min TTL. */
export async function signPhotoUrls(
  photos: BookingPhoto[],
  ttlSeconds = 300,
): Promise<(BookingPhoto & { signedUrl: string | null })[]> {
  if (photos.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const paths = photos.map((p) => p.storagePath);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, ttlSeconds);
  if (error) throw new Error(`signed urls failed: ${error.message}`);
  const byPath = new Map(
    (data ?? []).map((d) => [d.path ?? "", d.signedUrl] as const),
  );
  return photos.map((p) => ({ ...p, signedUrl: byPath.get(p.storagePath) ?? null }));
}
