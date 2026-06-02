import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — combine class names with conditional logic and Tailwind conflict resolution.
 *
 * Usage:
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an INR amount with Indian comma grouping.
 *   formatINR(15500)   → "15,500"
 *   formatINR(150000)  → "1,50,000"
 *   formatINR(150)     → "150"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

/**
 * Build "₹ X" rendering (uses non-breaking space so the rupee never wraps away).
 */
export function rupees(amount: number): string {
  return `₹ ${formatINR(amount)}`;
}

/**
 * Format an owner's display name as "First L." (e.g. "Imran K.").
 * Honours the locked design decision (Q3 = b).
 */
export function ownerLabel(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}.` : firstName;
}

/**
 * Approximate distance label, e.g. "~3 km".
 */
export function approxKm(km: number): string {
  if (km < 1) return `~${Math.max(1, Math.round(km * 10) / 10)} km`;
  return `~${Math.round(km)} km`;
}

/**
 * Coarse "time ago" label.
 * Used by reviews and recent jobs lists. We keep it intentionally rough
 * (week-/month-grain) since users don't care about exactness here.
 */
export function timeAgo(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  if (days < 730) return "1 year ago";
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Cap "jobs done" display at 100+ so newer/lower numbers don't feel inferior.
 */
export function jobsDoneLabel(n: number): string {
  if (n === 0) return "New on AutoGTG";
  if (n >= 100) return "100+ jobs done";
  return `${n} jobs done`;
}
