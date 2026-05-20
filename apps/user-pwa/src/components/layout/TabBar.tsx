"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/client";
import { t, type DictKey } from "@/lib/i18n/dict";

interface Tab {
  href: string;
  labelKey: DictKey;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { href: "/", labelKey: "tab.home", icon: Home },
  { href: "/bookings", labelKey: "tab.bookings", icon: ClipboardList },
  { href: "/profile", labelKey: "tab.profile", icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <nav
      className="sticky bottom-0 z-40 flex h-16 items-stretch border-t border-border-subtle bg-background"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "tap flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className="size-6"
              strokeWidth={isActive ? 2.25 : 2}
              fill={isActive ? "currentColor" : "none"}
              fillOpacity={isActive ? 0.12 : 0}
            />
            <span className={locale === "ur" ? "font-urdu" : undefined}>
              {t(locale, tab.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
