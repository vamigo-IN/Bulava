/**
 * Browser API client. All calls go to the same origin (/api/v1/*), which
 * Next rewrites to the API, so auth cookies stay first-party and httpOnly.
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
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'x-bulava-csrf': '1' },
    credentials: 'same-origin',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export async function api<T>(path: string, options: { method?: Method; body?: unknown; headers?: Record<string, string> } = {}, retry = true): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      ...options.headers,
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      'x-bulava-csrf': '1',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as Envelope<T> | null;

  // Only a missing or expired session means "sign in again". Other 401s answer a code (PIN, OTP,
  // two-step, a team invitation's code) and must never bounce anyone to the login page.
  const code = json?.error?.code;
  const sessionLost = response.status === 401 && (!code || code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED');
  if (sessionLost && retry && !path.startsWith('/auth/') && !path.startsWith('/public/')) {
    if (await refreshSession()) return api<T>(path, options, false);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }
  if (!response.ok || !json?.success) {
    throw new ApiError(
      json?.error?.code ?? (response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
      json?.error?.message ?? 'Something went wrong.',
      response.status,
      json?.error?.details,
    );
  }
  return json.data as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const apiPut = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
