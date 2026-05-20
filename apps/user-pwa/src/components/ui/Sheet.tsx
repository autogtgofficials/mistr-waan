"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Minimal bottom sheet — slides up from bottom with a backdrop.
 *
 * V0 scope:
 *   - Tap backdrop or press Escape to close
 *   - Body scroll locked while open
 *   - Slide-up animation via globals.css `.sheet-slide-up` class
 *   - No drag-to-dismiss (Step 3 spec defers this; works fine without)
 *
 * For more advanced behavior (drag, snap points, focus trap) we'll swap
 * to vaul or Radix Dialog later. This carries us through V0 cleanly.
 */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Header title. Optional — sheets can be untitled. */
  title?: React.ReactNode;
  /** Optional caption below title. */
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** ARIA label if no visible title. */
  ariaLabel?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  ariaLabel,
}: SheetProps) {
  /* Lock body scroll while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal aria-label={ariaLabel}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "sheet-slide-up relative max-h-[85vh] overflow-y-auto rounded-t-xl bg-card pb-6 shadow-lg",
          className,
        )}
      >
        {/* Drag handle */}
        <div className="flex h-6 items-center justify-center pt-3" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-steel-300" />
        </div>
        {title ? (
          <div className="px-5 pt-2 pb-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        <div className="px-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
