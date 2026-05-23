import { NextResponse } from "next/server";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import {
  listBookingPhotos,
  signPhotoUrls,
  uploadBookingPhoto,
  MAX_BYTES,
} from "@/lib/bookings/photos";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * GET  /api/bookings/[id]/photos — list photos with signed URLs (5 min ttl)
 * POST /api/bookings/[id]/photos — multipart/form-data: file=<File>
 *
 * Customer can upload + view their own booking's photos. Ops can view any.
 * Both routes accept only the booking owner or an ops session.
 */

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const customer = await getCustomerSession();
  const ops = await getOpsSession();
  if (!customer && !ops) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const booking = await getBookingById(id);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (customer && !ops && booking.profileId !== customer.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const photos = await listBookingPhotos(id);
  const signed = await signPhotoUrls(photos);
  return NextResponse.json({ photos: signed });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const customer = await getCustomerSession();
  const ops = await getOpsSession();
  if (!customer && !ops) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const booking = await getBookingById(id);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (customer && !ops && booking.profileId !== customer.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Multipart parsing — Web standard FormData works in Next.js route handlers.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }
  const file = formData.get("file");
  // FormData → File class identity isn't stable across runtimes (undici's
  // File ≠ globalThis.File in jsdom test env). Duck-type instead.
  if (
    !file ||
    typeof file === "string" ||
    typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function"
  ) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", detail: `max ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }
  const mimeType = file.type || "application/octet-stream";

  const actor = ops ? (ops.email ?? ops.sub) : customer!.sub;
  try {
    const bytes = await file.arrayBuffer();
    const photo = await uploadBookingPhoto({
      bookingId: id,
      bytes,
      mimeType,
    });
    await appendAuditEntry({
      action: "upload_photo",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { photoId: photo.id, storagePath: photo.storagePath, sizeBytes: photo.sizeBytes },
      outcome: "success",
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "upload_photo",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { mimeType, size: file.size },
      outcome: "error",
      error: message,
    });
    const status = message.startsWith("unsupported_mime")
      ? 415
      : message.startsWith("file_too_large")
        ? 413
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
