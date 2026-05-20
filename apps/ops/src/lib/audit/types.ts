export interface AuditEntry {
  id: string;
  at: string; // ISO timestamp
  action: string; // e.g. "patch_mechanic", "add_call_attempt"
  entityType: string;
  entityId: string;
  actor: string;
  payload?: unknown;
  before?: unknown;
  outcome: "success" | "error";
  error?: string;
}
