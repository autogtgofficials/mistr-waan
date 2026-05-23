import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  mode: "upi" | "cash";
  status: PaymentStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  capturedAt: string | null;
  createdAt: string;
}

function fromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    amount: row.amount,
    mode: row.mode,
    status: row.status,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  };
}

export async function createPendingPayment(opts: {
  bookingId: string;
  amount: number;
  razorpayOrderId: string;
}): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      booking_id: opts.bookingId,
      amount: opts.amount,
      mode: "upi",
      status: "pending",
      razorpay_order_id: opts.razorpayOrderId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`payment insert failed: ${error.message}`);
  return fromRow(data);
}

export async function markPaymentCaptured(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  rawPayload?: unknown;
}): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .update({
      razorpay_payment_id: opts.razorpayPaymentId,
      razorpay_signature: opts.razorpaySignature,
      status: "captured",
      captured_at: new Date().toISOString(),
      raw_payload: (opts.rawPayload ?? null) as Json,
    })
    .eq("razorpay_order_id", opts.razorpayOrderId)
    .select("*")
    .single();
  if (error) throw new Error(`payment update failed: ${error.message}`);
  return fromRow(data);
}

export async function markPaymentFailed(opts: {
  razorpayOrderId: string;
  rawPayload?: unknown;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("payments")
    .update({
      status: "failed",
      raw_payload: (opts.rawPayload ?? null) as Json,
    })
    .eq("razorpay_order_id", opts.razorpayOrderId);
  if (error) throw new Error(`payment fail update failed: ${error.message}`);
}

export async function findPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(`payment lookup failed: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function getLatestPaymentForBooking(bookingId: string): Promise<Payment | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`payment lookup failed: ${error.message}`);
  return data ? fromRow(data) : null;
}
