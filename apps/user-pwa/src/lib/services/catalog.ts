import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Bucket = Database["public"]["Enums"]["booking_bucket"];

export interface CatalogService {
  id: string;
  name: string;
  basePrice: number;
  durationLabel: string | null;
  blurb: string | null;
  isQuoted: boolean;
  bucket: Bucket;
}

/**
 * Read the active service catalog for a bucket, ordered for display.
 * Used by the web booking pages (server components) — the WhatsApp bot
 * reads the same table directly in its wizard.
 */
export async function listServicesByBucket(bucket: Bucket): Promise<CatalogService[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, base_price, duration_label, blurb, is_quoted, bucket")
    .eq("bucket", bucket)
    .eq("active", true)
    .order("display_order");
  if (error) throw new Error(`services catalog failed: ${error.message}`);
  return (data ?? []).map(toCatalogService);
}

/** All active services across every bucket — used by the ops create-booking form. */
export async function listAllActiveServices(): Promise<CatalogService[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, base_price, duration_label, blurb, is_quoted, bucket")
    .eq("active", true)
    .order("bucket")
    .order("display_order");
  if (error) throw new Error(`services catalog failed: ${error.message}`);
  return (data ?? []).map(toCatalogService);
}

function toCatalogService(s: {
  id: string;
  name: string;
  base_price: number;
  duration_label: string | null;
  blurb: string | null;
  is_quoted: boolean;
  bucket: Bucket;
}): CatalogService {
  return {
    id: s.id,
    name: s.name,
    basePrice: s.base_price,
    durationLabel: s.duration_label,
    blurb: s.blurb,
    isQuoted: s.is_quoted,
    bucket: s.bucket,
  };
}
