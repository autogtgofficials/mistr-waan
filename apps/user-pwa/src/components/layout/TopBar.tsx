"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocale, setLocaleCookie } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";

/**
 * Top app bar — h=56, persistent across most screens.
 *
 * Default variant shows brand mark + functional language toggle.
 * Override via props for screen-specific bars (back button, page title).
 */

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
      <div className="flex items-center gap-2">{right ?? <LanguageToggle />}</div>
    </header>
  );
}

/** AutoGTG brand mark — logo car symbol on Violet Pulse + wordmark. */
function BrandMark() {
  const locale = useLocale();
  return (
    <Link
      href="/"
      className="flex items-center gap-2 tap"
      aria-label={t(locale, "brand.name")}
    >
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md bg-primary"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark-white.png" alt="" className="h-4 w-auto" />
      </span>
      <span
        className={cn(
          "hidden text-base font-semibold text-foreground sm:inline",
          locale === "ur" && "font-urdu",
        )}
      >
        {t(locale, "brand.name")}
      </span>
    </Link>
  );
}

/**
 * Language toggle — flips locale cookie + reloads server-rendered routes
 * so `<html dir>` flips with it.
 */
function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();

  function toggle() {
    const next = locale === "en" ? "ur" : "en";
    setLocaleCookie(next);
    /* Force a full reload so server components (root layout, server pages)
       re-render with the new locale + dir attr. router.refresh() works for
       server components but doesn't reset hooks tied to locale state. */
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="tap rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
      aria-label={t(locale, "lang.toggleAria")}
    >
      <span className={locale === "en" ? "text-foreground font-semibold" : "text-muted-foreground"}>
        EN
      </span>
      <span className="mx-1 text-muted-foreground">|</span>
      <span
        className={locale === "ur" ? "text-foreground font-semibold" : "text-muted-foreground"}
        lang="ur"
      >
        اردو
      </span>
    </button>
  );
}
