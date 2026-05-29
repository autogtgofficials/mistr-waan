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
    .select("id, name, base_price, duration_label, blurb, is_quoted")
    .eq("bucket", bucket)
    .eq("active", true)
    .order("display_order");
  if (error) throw new Error(`services catalog failed: ${error.message}`);
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    basePrice: s.base_price,
    durationLabel: s.duration_label,
    blurb: s.blurb,
    isQuoted: s.is_quoted,
  }));
}
