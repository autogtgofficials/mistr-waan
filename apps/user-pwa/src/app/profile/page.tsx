"use client";

import Link from "next/link";
import { useState } from "react";
import { User, LogOut, Phone, Globe, MessageCircle, FileQuestion } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useAuth } from "@/lib/store/auth";

/**
 * /profile — minimal profile screen.
 *
 * Logged-in: name, phone, language, support links, sign out.
 * Logged-out: a friendly "sign in" prompt.
 */
export default function ProfilePage() {
  const { user, hydrated, signOut, updateName } = useAuth();
  const [nameOpen, setNameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!hydrated) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1" />
        <TabBar />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            icon={User}
            title="Sign in to see your profile"
            body="We'll save your bookings and language preference here."
            action={
              <Link
                href="/login?next=/profile"
                className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            }
          />
        </main>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <ActiveJobBar />
      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Identity card */}
          <div className="flex items-center gap-4">
            <span
              className="flex size-16 items-center justify-center rounded-full bg-pulse-100 text-pulse-700 text-xl font-semibold"
              aria-hidden
            >
              {user.firstName.charAt(0).toUpperCase()}
            </span>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground">{user.firstName}</h1>
              <p className="tabular text-sm text-muted-foreground">{user.phone}</p>
            </div>
          </div>

          <Divider />

          {/* Account */}
          <Section title="Account">
            <Row
              icon={User}
              label="Name"
              value={user.firstName}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(user.firstName);
                    setNameOpen(true);
                  }}
                  className="text-sm text-primary font-medium underline-offset-2 hover:underline"
                >
                  Edit
                </button>
              }
            />
            <Row icon={Phone} label="Phone" value={user.phone} />
            <Row
              icon={Globe}
              label="Language"
              value={user.language === "ur" ? "اردو" : "English"}
            />
          </Section>

          <Divider />

          {/* Support */}
          <Section title="Support">
            <a
              href="https://wa.me/918888888888"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card p-4 hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <MessageCircle className="size-5 text-foreground" strokeWidth={2} />
                <span className="text-base font-medium text-foreground">WhatsApp us</span>
              </span>
            </a>
            <a
              href="#"
              className="mt-2 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card p-4 hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <FileQuestion className="size-5 text-foreground" strokeWidth={2} />
                <span className="text-base font-medium text-foreground">FAQ</span>
              </span>
            </a>
          </Section>

          <Divider />

          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-center text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </Button>
        </div>
      </main>

      <TabBar />

      <Sheet
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="Your name"
        description="What should we call you?"
      >
        <input
          type="text"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Imran"
          className="mt-2 w-full rounded-md border border-input bg-card p-3 text-base text-foreground outline-none placeholder:text-steel-300 focus:ring-2 focus:ring-ring focus:ring-offset-1"
        />
        <div className="mt-4 flex flex-col gap-2 pb-2">
          <Button
            onClick={() => {
              if (draftName.trim()) {
                updateName(draftName.trim());
              }
              setNameOpen(false);
            }}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={() => setNameOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
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
  action,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-foreground" strokeWidth={2} />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-base text-foreground">{value}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}
