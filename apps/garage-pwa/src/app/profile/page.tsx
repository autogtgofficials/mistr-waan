"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Phone,
  Store,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { useGarageAuth } from "@/lib/store/auth";
import { MOCK_GARAGE } from "@/lib/mock/garage";
import { ownerLabel } from "@/lib/utils";

export default function GarageProfilePage() {
  const router = useRouter();
  const { user, isAuthed, hydrated, signOut } = useGarageAuth();

  useEffect(() => {
    if (hydrated && !isAuthed) router.replace("/login");
  }, [hydrated, isAuthed, router]);

  if (!hydrated || !isAuthed) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1" />
        <TabBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Identity card */}
          <div className="flex items-center gap-4">
            <span
              className="flex size-16 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 text-xl font-semibold"
              aria-hidden
            >
              {(MOCK_GARAGE.ownerFirstName.charAt(0) + MOCK_GARAGE.ownerLastName.charAt(0)).toUpperCase()}
            </span>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground">
                {ownerLabel(MOCK_GARAGE.ownerFirstName, MOCK_GARAGE.ownerLastName)}
              </h1>
              <p className="text-sm text-foreground">{MOCK_GARAGE.shopName}</p>
              <p className="text-xs text-muted-foreground tabular">
                ★ {MOCK_GARAGE.rating} · {MOCK_GARAGE.jobsCompleted} jobs
              </p>
            </div>
          </div>

          <Divider />

          <Section title="Shop">
            <Row icon={Store} label="Shop name" value={MOCK_GARAGE.shopName} />
            <Row icon={MapPin} label="Address" value={MOCK_GARAGE.fullAddress} />
            <Row
              icon={Phone}
              label="Phone"
              value={user?.phone ?? MOCK_GARAGE.ownerPhone}
            />
          </Section>

          <Divider />

          <Section title="Service capabilities">
            <div className="flex flex-wrap gap-2">
              {MOCK_GARAGE.serviceBuckets.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700 capitalize"
                >
                  {b}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Update your service list by WhatsApping ops at{" "}
              <span className="tabular font-semibold">+91 80000 11122</span>.
            </p>
          </Section>

          <Divider />

          <Section title="Support">
            <a
              href="https://wa.me/918000011122"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card p-4 hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <MessageCircle className="size-5 text-foreground" strokeWidth={2} />
                <span className="text-base font-medium text-foreground">WhatsApp ops</span>
              </span>
            </a>
          </Section>

          <Divider />

          <Button
            variant="ghost"
            onClick={() => void signOut()}
            className="w-full justify-center text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </Button>
        </div>
      </main>

      <TabBar />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
      <Icon className="mt-0.5 size-5 text-foreground" strokeWidth={2} />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-base text-foreground">{value}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}
