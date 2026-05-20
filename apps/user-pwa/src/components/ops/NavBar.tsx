import Link from "next/link";

export function NavBar({ total }: { total: number }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/ops" className="flex items-center gap-2">
          <span className="size-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center text-xs font-bold">
            W
          </span>
          <span className="font-semibold text-foreground">Mister Waan · Ops</span>
          <span className="ms-2 text-xs text-muted-foreground tabular">
            ({total} mechanics)
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/ops">List</NavLink>
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
      className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  );
}
