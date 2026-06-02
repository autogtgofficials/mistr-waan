import Link from "next/link";

export function NavBar({
  total,
  queuedCalls = 0,
}: {
  total: number;
  queuedCalls?: number;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/ops" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark-white.png" alt="" className="h-3.5 w-auto" />
          </span>
          <span className="font-semibold text-foreground">AutoGTG · Ops</span>
          <span className="ms-2 text-xs text-muted-foreground tabular">
            ({total} mechanics)
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/ops/calls">
            Calls
            {queuedCalls > 0 ? (
              <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ignite-500 px-1.5 text-[11px] font-bold text-white tabular">
                {queuedCalls}
              </span>
            ) : null}
          </NavLink>
          <NavLink href="/ops/bookings">Bookings</NavLink>
          <NavLink href="/ops">Mechanics</NavLink>
          <NavLink href="/ops/map">Map</NavLink>
          <NavLink href="/ops/coverage">Coverage</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
