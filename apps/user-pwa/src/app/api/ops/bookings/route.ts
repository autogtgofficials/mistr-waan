import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings } from "@/lib/bookings/ops-data";
import type { BookingBucket, BookingStatus } from "@/lib/bookings/types";

export const runtime = "nodejs";

const VALID_STATUSES: BookingStatus[] = [
  "queued_for_call",
  "quoted",
  "awaiting_garage",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
  "declined_by_garage",
];
const VALID_BUCKETS: BookingBucket[] = ["detailing", "repairs", "denting"];

export async function GET(request: Request) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const bucketRaw = url.searchParams.get("bucket");
  const limitRaw = url.searchParams.get("limit");

  const status =
    statusRaw && (statusRaw === "all" || VALID_STATUSES.includes(statusRaw as BookingStatus))
      ? (statusRaw as BookingStatus | "all")
      : undefined;
  const bucket =
    bucketRaw && (bucketRaw === "all" || VALID_BUCKETS.includes(bucketRaw as BookingBucket))
      ? (bucketRaw as BookingBucket | "all")
      : undefined;
  const limit = limitRaw ? Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 100)) : 100;

  const bookings = await listOpsBookings({ status, bucket, limit });
  return NextResponse.json({ bookings });
}
