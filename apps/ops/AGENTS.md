<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Audit Logging

Any API route that creates, updates, or deletes data **must** call `appendAuditEntry()` from `@/lib/audit/log` after the operation completes (both success and error paths). Rules:

- Import: `import { appendAuditEntry } from "@/lib/audit/log";`
- `action`: snake_case verb, e.g. `"patch_mechanic"`, `"add_call_attempt"`, `"create_mechanic"`.
- `entityType`: lowercase model name, e.g. `"mechanic"`.
- `entityId`: the record's id.
- `actor`: read from `request.headers.get("x-actor") ?? "unknown"` — real auth will replace this later.
- `payload`: the request body or a trimmed subset. Omit large blobs/arrays.
- `before`: snapshot of mutable fields BEFORE the write so diffs are possible.
- `outcome`: `"success"` after a successful write, `"error"` on 404/500 with `error` string.
- The function is async but you should **not** block the response on it — fire-and-forget pattern (`appendAuditEntry(...).catch(() => {})`) is fine for the success path. Await it on the error path since you're already returning an error.
- The store, types, and API route (`GET /api/audit`) already exist. The audit viewer page is at `/audit`.
- Do not recreate `lib/audit/` — it already exists.
