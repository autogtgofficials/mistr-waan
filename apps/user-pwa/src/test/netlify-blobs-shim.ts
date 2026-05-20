// Shim for `@netlify/blobs` under Vitest. The real package only runs in the
// Netlify production environment (NETLIFY=true); local tests use the filesystem
// backend, so this stub is never reached. Export the minimum surface area we
// touch so the import succeeds at transform time.

export function getStore(): {
  get(): Promise<null>;
  set(): Promise<void>;
  delete(): Promise<void>;
  list(): Promise<{ blobs: never[] }>;
} {
  throw new Error("netlify-blobs-shim should never be called under Vitest");
}
