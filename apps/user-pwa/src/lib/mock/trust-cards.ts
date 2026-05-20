/**
 * Trust-card definitions referenced by the Home hero slot.
 * Visual data only — translation keys live in src/lib/i18n/dict.ts.
 */

import type { LucideIcon } from "lucide-react";
import { Sparkles, ShieldCheck, PhoneOff } from "lucide-react";
import type { DictKey } from "@/lib/i18n/dict";

export interface TrustCard {
  id: string;
  icon: LucideIcon;
  headlineKey: DictKey;
  tint: "pulse" | "aqua" | "ignite";
}

export const trustCards: TrustCard[] = [
  { id: "money-safe", icon: Sparkles, headlineKey: "trust.money", tint: "pulse" },
  { id: "vetted", icon: ShieldCheck, headlineKey: "trust.vetted", tint: "aqua" },
  { id: "private-call", icon: PhoneOff, headlineKey: "trust.privacy", tint: "ignite" },
];
