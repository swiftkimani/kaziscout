/** An error the API reported in its standard envelope. `message` is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Per-field messages from a validation failure, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const fields = this.details.fields;
    if (!fields || typeof fields !== 'object') return {};
    return Object.fromEntries(
      Object.entries(fields as Record<string, unknown>)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
        .map(([name, messages]) => [name, messages[0] ?? '']),
    );
  }
}

interface ErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return typeof body === 'object' && body !== null && 'error' in body;
}

/** Calls the API and returns the parsed JSON body. Throws ApiError for error responses. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isErrorEnvelope(body)) {
      const { code, message, details } = body.error;
      throw new ApiError(code, message, response.status, details ?? {});
    }
    throw new ApiError('UNKNOWN', 'The server sent an unexpected answer.', response.status, {});
  }
  return body as T;
}
