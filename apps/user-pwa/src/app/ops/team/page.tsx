import { redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsUsers } from "@/lib/ops/users";
import { OpsTeamControls } from "./OpsTeamControls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsTeamPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/team");

  const users = await listOpsUsers();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <Link href="/ops/bookings" className="text-sm text-muted-foreground hover:underline">
              ← Ops
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">Ops · Team</h1>
          </div>
          <span className="text-sm text-muted-foreground">Signed in as {session.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <OpsTeamControls
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            active: u.active,
            inviteAcceptedAt: u.inviteAcceptedAt,
            lastLoginAt: u.lastLoginAt,
          }))}
        />
      </main>
    </div>
  );
}
