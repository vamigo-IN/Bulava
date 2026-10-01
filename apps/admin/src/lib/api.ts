/**
 * Browser API client. Calls go to the admin origin (/api/v1/*), which Next
 * rewrites to the API, so the staff session cookies stay first-party.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', headers: { 'x-bulava-csrf': '1' }, credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}, retry = true): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}), 'x-bulava-csrf': '1' },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as Envelope<T> | null;

  // Only a missing or expired session means "sign in again". A wrong password or code (the
  // handover, two-step resets) is also a 401, and retrying it would count the mistake twice.
  const code = json?.error?.code;
  const sessionLost = response.status === 401 && (!code || code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED');
  if (sessionLost && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, options, false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }
  if (!response.ok || !json?.success) {
    throw new ApiError(json?.error?.code ?? 'INTERNAL_ERROR', json?.error?.message ?? 'Something went wrong.', response.status, json?.error?.details);
  }
  return json.data as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const apiPut = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Readable message for an error, including field-level validation details. */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const details = error.details;
  if (Array.isArray(details) && details.length) {
    const first = details[0] as { path?: string; message?: string };
    return `${error.message} ${first.path ? `${first.path}: ` : ''}${first.message ?? ''}`.trim();
  }
  return error.message;
}

/**
 * Admin uploads: ask the API for a signed URL, PUT the file straight to
 * storage, and return the storage key to register the asset with.
 */
export async function uploadToStorage(kind: 'asset' | 'music', file: File): Promise<string> {
  const signed = await apiPost<{ storageKey: string; uploadUrl: string; headers: Record<string, string> }>(`/admin/uploads/${kind}`, {
    contentType: file.type,
    fileName: file.name.slice(0, 200),
  });
  const put = await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: signed.headers });
  if (!put.ok) throw new ApiError('UPLOAD_FAILED', `Upload failed (${put.status}).`, put.status);
  return signed.storageKey;
}
