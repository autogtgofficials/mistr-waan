"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Wrench, Sparkles, PaintBucket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/client";
import { t, type DictKey } from "@/lib/i18n/dict";

interface ServiceCardProps {
  bucket: "repairs" | "detailing" | "denting";
  fullWidth?: boolean;
  className?: string;
}

const META = {
  repairs: {
    icon: Wrench,
    href: "/repairs",
    labelKey: "bucket.repairs.label" as DictKey,
    blurbKey: "bucket.repairs.blurb" as DictKey,
    tintBg: "bg-pulse-50",
    tintFg: "text-pulse-700",
  },
  detailing: {
    icon: Sparkles,
    href: "/detailing",
    labelKey: "bucket.detailing.label" as DictKey,
    blurbKey: "bucket.detailing.blurb" as DictKey,
    tintBg: "bg-aqua-50",
    tintFg: "text-aqua-700",
  },
  denting: {
    icon: PaintBucket,
    href: "/denting",
    labelKey: "bucket.denting.label" as DictKey,
    blurbKey: "bucket.denting.blurb" as DictKey,
    tintBg: "bg-ignite-50",
    tintFg: "text-ignite-700",
  },
} as const satisfies Record<
  string,
  {
    icon: LucideIcon;
    href: string;
    labelKey: DictKey;
    blurbKey: DictKey;
    tintBg: string;
    tintFg: string;
  }
>;

export function ServiceCard({ bucket, fullWidth = false, className }: ServiceCardProps) {
  const meta = META[bucket];
  const Icon = meta.icon;
  const locale = useLocale();

  return (
    <Link
      href={meta.href}
      className={cn(
        "tap group flex items-start gap-4 rounded-md border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.98]",
        fullWidth ? "flex-row" : "flex-col gap-3",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-md",
          meta.tintBg,
        )}
        aria-hidden
      >
        <Icon className={cn("size-6", meta.tintFg)} strokeWidth={2} />
      </span>
      <span className="flex flex-col">
        <span
          className={cn(
            "text-lg font-semibold text-foreground leading-tight",
            locale === "ur" && "font-urdu",
          )}
        >
          {t(locale, meta.labelKey)}
        </span>
        <span
          className={cn(
            "text-sm text-muted-foreground mt-1",
            locale === "ur" && "font-urdu",
          )}
        >
          {t(locale, meta.blurbKey)}
        </span>
      </span>
    </Link>
  );
}
