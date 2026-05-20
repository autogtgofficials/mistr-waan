// In production this resolves to the `server-only` package, which throws when
// imported into a client bundle. Under Vitest there is no client/server boundary
// to enforce, so this shim is a no-op.
export {};
