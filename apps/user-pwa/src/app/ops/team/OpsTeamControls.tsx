"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";

interface OpsUserSummary {
  id: string;
  email: string;
  role: "ops" | "admin";
  active: boolean;
  inviteAcceptedAt: string | null;
  lastLoginAt: string | null;
}

export function OpsTeamControls({ users: initialUsers }: { users: OpsUserSummary[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ops" | "admin">("ops");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ email: string; acceptUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastInvite(null);
    try {
      const res = await fetch("/api/ops/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json()) as {
        invite?: { id: string; email: string; role: "ops" | "admin"; active: boolean; acceptUrl: string | null };
        error?: string;
      };
      if (!res.ok || !data.invite) throw new Error(data.error ?? `HTTP ${res.status}`);
      setUsers((prev) => {
        const without = prev.filter((u) => u.email !== data.invite!.email);
        return [
          ...without,
          {
            id: data.invite!.id,
            email: data.invite!.email,
            role: data.invite!.role,
            active: data.invite!.active,
            inviteAcceptedAt: null,
            lastLoginAt: null,
          },
        ];
      });
      if (data.invite.acceptUrl) {
        setLastInvite({ email: data.invite.email, acceptUrl: data.invite.acceptUrl });
      }
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!lastInvite) return;
    await navigator.clipboard.writeText(lastInvite.acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Invite a seat
        </h2>
        <form onSubmit={invite} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@autogtg.com"
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ops" | "admin")}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ops">Ops</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !email}
            className="h-9 rounded-md bg-pulse-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </form>
        {error ? <p className="mt-3 text-xs text-ignite-700">{error}</p> : null}
        {lastInvite ? (
          <div className="mt-3 rounded-md border border-aqua-100 bg-aqua-50 p-3">
            <p className="text-xs text-aqua-900">
              Invite created for <strong>{lastInvite.email}</strong>. Send them this link
              (we don&apos;t auto-email yet):
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-card px-2 py-1 text-xs text-foreground tabular">
                {lastInvite.acceptUrl}
              </code>
              <button
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-card px-2 py-1 text-xs hover:bg-muted"
              >
                <Copy className="size-3" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Seats ({users.length})
        </h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pe-3">Email</th>
              <th className="py-2 pe-3">Role</th>
              <th className="py-2 pe-3">Status</th>
              <th className="py-2 pe-3">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border-subtle">
                <td className="py-3 pe-3">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5 text-muted-foreground" /> {u.email}
                  </span>
                </td>
                <td className="py-3 pe-3 capitalize">{u.role}</td>
                <td className="py-3 pe-3">
                  {u.active ? (
                    <span className="inline-flex items-center rounded-full bg-aqua-50 px-2 py-0.5 text-xs text-aqua-700">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-pulse-50 px-2 py-0.5 text-xs text-pulse-700">
                      Invite pending
                    </span>
                  )}
                </td>
                <td className="py-3 pe-3 text-muted-foreground text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
