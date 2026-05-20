import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-8 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted"
          aria-hidden
        >
          <Icon className="size-7 text-muted-foreground" strokeWidth={2} />
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
