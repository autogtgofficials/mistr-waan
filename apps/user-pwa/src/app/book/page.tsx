import Link from "next/link";
import { Wrench, Siren, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";

export const metadata = { title: "Book a service · Mistr Waan" };

/**
 * /book — module-picker landing aligned with the blueprint's three front
 * doors: Scheduled Maintenance, Roadside Assistance, Additional Services.
 *
 * Maintenance + RSA route to their own DB-backed pages. "Additional" routes
 * to the existing detailing/repairs/denting flows.
 */
export default function BookLandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar title={<span>Book a service</span>} />
      <main className="flex-1 pb-24">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">What do you need?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a category to get started.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <ModuleTile
              href="/maintenance"
              icon={<Wrench className="size-6" strokeWidth={2} />}
              title="Scheduled Maintenance"
              subtitle="Oil change, brakes, battery, tyres — car & bike"
              tone="pulse"
            />
            <ModuleTile
              href="/rsa"
              icon={<Siren className="size-6" strokeWidth={2} />}
              title="Roadside Assistance"
              subtitle="Puncture, jump-start, towing, breakdown"
              tone="ignite"
            />
            <ModuleTile
              href="/detailing"
              icon={<Sparkles className="size-6" strokeWidth={2} />}
              title="Additional Services"
              subtitle="Detailing, repairs, denting & painting"
              tone="aqua"
            />
          </div>

          <div className="mt-6 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Prefer WhatsApp? Message us &quot;BOOK&quot; on the Mistr Waan number and
            our bot will walk you through it.
          </div>
        </div>
      </main>
      <TabBar />
    </div>
  );
}

function ModuleTile({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "pulse" | "ignite" | "aqua";
}) {
  const toneClass =
    tone === "pulse"
      ? "bg-pulse-50 text-pulse-700"
      : tone === "ignite"
        ? "bg-orange-50 text-ignite-700"
        : "bg-aqua-50 text-aqua-700";
  return (
    <Link
      href={href}
      className="tap flex items-center gap-4 rounded-md border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-md ${toneClass}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}
