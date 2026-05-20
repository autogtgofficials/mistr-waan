import { cn } from "@/lib/utils";

/**
 * Sticky bottom CTA bar — used by every booking step.
 *
 * Sits above the tab bar (h=64) when present, otherwise flush bottom.
 * Provide either a single primary action (default) or arbitrary children
 * for custom content (e.g. "Total: ₹X · Continue ›").
 */

export interface BottomCTAProps {
  children: React.ReactNode;
  /** Sit above tab bar instead of flush bottom. */
  aboveTabBar?: boolean;
  className?: string;
}

export function BottomCTA({ children, aboveTabBar = false, className }: BottomCTAProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border bg-background px-4 py-3",
        aboveTabBar ? "bottom-16" : "bottom-0",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
