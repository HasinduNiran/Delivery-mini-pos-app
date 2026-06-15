import { config } from '@/config';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

// Thin fetch wrapper: injects the API key, JSON-encodes the body, applies a
// timeout, and surfaces server error messages as ApiError.
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, signal, timeoutMs = 15000 }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // Forward an external abort signal to our controller.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status})`;
      throw new ApiError(res.status, message);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Check your connection.');
    }
    throw new ApiError(0, `Network error — can't reach ${config.apiUrl}`);
  } finally {
    clearTimeout(timeout);
  }
}
