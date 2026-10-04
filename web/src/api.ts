import { MSG } from '@acme/shared';

/** A failed API call, with the server's plain message and any per-field messages. */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Calls the API with JSON in and out; any failure becomes an ApiError with a message in plain words. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, MSG.offline);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? MSG.serverError, data?.fields);
  return data as T;
}
