import { NavBar } from "@/components/NavBar";
import { getAuditEntries } from "@/lib/audit/log";
import { getAllMechanics } from "@/lib/mechanics/data";
import type { AuditEntry } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  patch_mechanic: "Profile updated",
  add_call_attempt: "Call logged",
};

const OUTCOME_CLASSES: Record<AuditEntry["outcome"], string> = {
  success: "bg-green-50 text-green-700 ring-green-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
};

function formatAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function MetaRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      {typeof value === "object" ? JSON.stringify(value) : String(value)}
    </span>
  );
}

export default async function AuditPage() {
  const [entries, mechanics] = await Promise.all([
    getAuditEntries(500),
    getAllMechanics(),
  ]);

  const mechanicNames = new Map(mechanics.map((m) => [m.id, m.name || m.shopName || m.id]));

  return (
    <>
      <NavBar total={mechanics.length} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last {entries.length} ops actions — newest first.
          </p>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-background">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {mechanicNames.get(entry.entityId) ?? entry.entityId}
                  </span>
                  {entry.actor !== "unknown" && (
                    <span className="text-xs text-muted-foreground">
                      by {entry.actor}
                    </span>
                  )}
                  {Boolean(entry.payload) && typeof entry.payload === "object" && (
                    <span className="w-full flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {Object.entries(entry.payload as Record<string, unknown>)
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([k, v]) => (
                          <MetaRow key={k} label={k} value={v} />
                        ))}
                    </span>
                  )}
                  {Boolean(entry.before) && typeof entry.before === "object" && (
                    <span className="w-full flex flex-wrap gap-x-4 gap-y-0.5">
                      {Object.entries(entry.before as Record<string, unknown>)
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([k, v]) => (
                          <MetaRow key={k} label={`before.${k}`} value={v} />
                        ))}
                    </span>
                  )}
                  {entry.error && (
                    <span className="w-full text-xs text-red-600">{entry.error}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${OUTCOME_CLASSES[entry.outcome]}`}
                  >
                    {entry.outcome}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatAt(entry.at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
