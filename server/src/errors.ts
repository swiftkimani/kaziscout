/** Base class for errors that map to a specific HTTP status and error code. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super('NOT_FOUND', 404, `${what} was not found.`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('VALIDATION_FAILED', 400, message, details);
  }
}

/** The address is not one KaziScout will fetch (bad scheme, private network, and so on). */
export class UnsafeUrlError extends AppError {
  constructor(reason: string) {
    super('UNSAFE_URL', 400, `That address can't be fetched: ${reason}.`);
  }
}

/** A job board, page, or third-party API did not answer usefully. */
export class UpstreamError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('UPSTREAM_FAILED', 502, message, details);
  }
}

/** A feature was requested that needs configuration the user has not provided. */
export class NotConfiguredError extends AppError {
  constructor(message: string) {
    super('NOT_CONFIGURED', 409, message);
  }
}
