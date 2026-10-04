import { MSG } from '@acme/shared';

/** A failed API call, with the server's plain message, any per-field messages, and the whole reply. */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data: unknown;
  constructor(status: number, message: string, fields: Record<string, string> = {}, data: unknown = null) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

/** Calls the API with JSON (or CSV text) in and JSON out; any failure becomes an ApiError with a message in plain words. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; csv?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        // TIME-1: the server works out "today" in the browser's timezone.
        'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.csv === undefined ? {} : { 'content-type': 'text/csv; charset=utf-8' }),
      },
      body: init.csv ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, MSG.offline);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? MSG.serverError, data?.fields, data);
  return data as T;
}
