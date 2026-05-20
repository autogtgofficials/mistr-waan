export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload?: unknown;
  before?: unknown;
  outcome: "success" | "error";
  error?: string;
}
