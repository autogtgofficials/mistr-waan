/**
 * Cross-origin API client for the garage PWA → user-pwa backend.
 *
 * `NEXT_PUBLIC_APP_ORIGIN` points at the user-pwa host (e.g.
 * `https://autogtg.com` in prod, `http://localhost:3000` in dev).
 *
 * All requests use `credentials: "include"` so the `mw_garage_session`
 * cookie travels across subdomains (set with `domain=.autogtg.com`).
 *
 * Returns the parsed JSON body on success. On non-2xx, throws an `ApiError`
 * with the server's `error` field.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function apiOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${apiOrigin()}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  // 204 No Content from preflight signouts etc.
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `http_${res.status}`, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: "POST", json: json ?? {} }),
  patch: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: "PATCH", json: json ?? {} }),
};
