import "server-only";

/**
 * Whether to persist to Netlify Blobs (deployed) vs the local filesystem (dev).
 *
 * `NETLIFY` is set at BUILD time but is NOT reliably present at function
 * RUNTIME, so the old `NETLIFY === "true"` check fell through to the filesystem
 * inside the deployed Lambda — where `mkdir`/`writeFile` throw ENOENT/EROFS and
 * 500 the request. Netlify functions run on AWS Lambda, which always sets
 * `LAMBDA_TASK_ROOT` (=/var/task), and the Blobs context is injected at runtime
 * via `NETLIFY_BLOBS_CONTEXT`. Detect any of those → use Blobs.
 *
 * Local `next dev` and Vitest set none of these → filesystem, as before.
 */
export function useBlobs(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.LAMBDA_TASK_ROOT)
  );
}
