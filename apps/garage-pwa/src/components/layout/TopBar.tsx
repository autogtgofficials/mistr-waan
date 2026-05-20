import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TopBarProps {
  left?: React.ReactNode;
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ left, title, right, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-background px-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">{left ?? <BrandMark />}</div>
      {title ? (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold text-foreground">
          {title}
        </div>
      ) : null}
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 tap" aria-label="Mister Waan Garage">
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold"
      >
        MW
      </span>
      <span className="hidden text-base font-semibold text-foreground sm:inline">
        Mister Waan
      </span>
      <span className="ms-1 rounded-full bg-aqua-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aqua-700">
        Garage
      </span>
    </Link>
  );
}
