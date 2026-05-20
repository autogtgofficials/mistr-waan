<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Audit Logging

Any API route that creates, updates, or deletes data should log the action. The canonical audit implementation lives in the `ops` app at `apps/ops/src/lib/audit/`. When this app gains real write routes (bookings, jobs, auth), mirror the same pattern here:

- A `lib/audit/` directory with `types.ts`, `log.ts` (FilesystemStore + BlobsStore)
- Call `appendAuditEntry()` on both success and error paths
- `actor` from session/headers, `entityType` lowercase, `before` snapshot for diffs
- Add a `GET /api/audit` route and an `/audit` page visible to ops/admin users only
