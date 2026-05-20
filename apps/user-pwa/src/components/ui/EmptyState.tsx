import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic empty / error state. Used by lists and routes that have no data.
 *
 * For empty + error variants we keep the same layout (icon + heading + body
 * + optional action). Error tints use `danger`, empty uses `muted`.
 */

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "empty" | "error";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  variant = "empty",
  className,
}: EmptyStateProps) {
  const tintBg = variant === "error" ? "bg-danger-soft" : "bg-muted";
  const tintFg = variant === "error" ? "text-danger" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-8 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mb-4 flex size-16 items-center justify-center rounded-full",
            tintBg,
          )}
          aria-hidden
        >
          <Icon className={cn("size-7", tintFg)} strokeWidth={2} />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {body ? (
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">{body}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
