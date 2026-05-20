import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Button — minimal primitive matching the design-system Button spec.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm (h=40) | md (h=48 default) | lg (h=56)
 * Width:    full-width on mobile by default; `inline` to opt out.
 * Loading:  spinner replaces label, button stays full-width to avoid layout shift.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-pulse-600 active:bg-pulse-700 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
  secondary:
    "bg-card text-primary border border-primary hover:bg-pulse-50 active:bg-pulse-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent",
  ghost:
    "text-primary hover:bg-pulse-50 active:bg-pulse-100 disabled:text-muted-foreground",
  danger:
    "bg-danger text-danger-foreground shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-base",
  lg: "h-14 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  inline?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      inline = false,
      className,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "tap inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:active:scale-100",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          inline ? "" : "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? <Spinner /> : children}
      </button>
    );
  },
);

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}
