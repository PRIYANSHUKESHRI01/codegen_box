import { getToken } from "./auth";
import { ACCOUNT_BLOCKED_CODE, announceSessionEnded } from "./sessionEvents";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  /** Machine-readable reason some endpoints add next to `message` (e.g. "no_speech"), so the UI can react without parsing text. */
  code?: string;

  constructor(message: string, status: number, errors?: Record<string, string[]>, code?: string) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

async function throwForFailedResponse(res: Response, hadToken = false): Promise<never> {
  const data = await res.json().catch(() => null);
  const firstError = data?.errors ? Object.values(data.errors)[0] : undefined;
  const message =
    data?.message ?? (Array.isArray(firstError) ? firstError[0] : "Something went wrong. Please try again.");
  const code = typeof data?.code === "string" ? data.code : undefined;

  // The server ended this session behind the page's back. Say so once, app-wide, instead of every
  // screen failing separately: a superadmin blocked the account (403 account_blocked), or signed it
  // out of every device / the token expired (401 on a request that carried a token).
  if (hadToken && res.status === 403 && code === ACCOUNT_BLOCKED_CODE) {
    announceSessionEnded({ reason: "blocked", message });
  } else if (hadToken && res.status === 401) {
    announceSessionEnded({ reason: "signed_out", message: "You were signed out. Please sign in again." });
  }

  throw new ApiError(message, res.status, data?.errors, code);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) return throwForFailedResponse(res, !!token);

  return (await res.json().catch(() => null)) as T;
}

/** Multipart uploads (e.g. a CSV file) — no Content-Type header, so the
 * browser can set it itself with the correct multipart boundary. */
async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) return throwForFailedResponse(res, !!token);

  return (await res.json().catch(() => null)) as T;
}

/** Authenticated file downloads (e.g. the CSV import template) — a plain
 * `<a href>` can't carry a Bearer token, so this fetches the bytes directly
 * for the caller to turn into a download via an object URL. */
async function requestBlob(path: string): Promise<Blob> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) return throwForFailedResponse(res, !!token);

  return res.blob();
}

// Dedupe identical concurrent GETs (e.g. React 18 dev Strict Mode's
// mount->cleanup->remount fires effects twice, which would otherwise send
// two /api/me requests back-to-back against the single-threaded
// `php artisan serve` dev server and serialize their latency).
const inFlightGets = new Map<string, Promise<unknown>>();

function dedupedGet<T>(path: string): Promise<T> {
  const existing = inFlightGets.get(path);
  if (existing) return existing as Promise<T>;

  const promise = request<T>(path, { method: "GET" }).finally(() => {
    inFlightGets.delete(path);
  });
  inFlightGets.set(path, promise);
  return promise;
}

export const api = {
  get: <T>(path: string) => dedupedGet<T>(path),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...init }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, ...init }),
  // `body` is optional so every existing one-argument call is unchanged; the superadmin
  // "permanently delete a university" call sends the confirmation (password + typed name).
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>(path, formData),
  getFile: (path: string) => requestBlob(path),
};
