/**
 * The app's error vocabulary.
 *
 * Everything that a caller might reasonably want to *react* to — as opposed to
 * "the database is on fire" — is thrown as an `AppError` carrying a `code`. Two
 * places consume that code:
 *
 * - `core/action.ts` turns it into an `ActionResult` for Server Actions.
 * - `core/http.ts` turns it into an HTTP status for Route Handlers.
 *
 * Anything else that gets thrown is treated as `INTERNAL`: logged with its
 * stack, and reported to the caller as nothing more than the code. That split is
 * the point — a thrown `Error` from a service is a bug, and bug details must not
 * reach the client.
 *
 * Why a class hierarchy rather than one class plus a string: `throw new
 * NotFoundError('note')` reads better at the throw site than `throw new
 * AppError('NOT_FOUND', 'note')`, and `instanceof AppError` still catches all of
 * them in one check.
 */

export type AppErrorCode =
	| 'VALIDATION'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'RATE_LIMITED'
	| 'INTERNAL'

export class AppError extends Error {
	readonly code: AppErrorCode
	/**
	 * Field names this error belongs to, when it can be attributed to specific
	 * form fields — `['phone']` for "this number is already registered".
	 *
	 * Only the *names* travel, never a message: schemas in this project carry no
	 * locale-specific text (see `core/auth/schema.ts`), so the client renders its
	 * own translated string keyed off which field failed. Putting a message here
	 * would guarantee it's in the wrong language for someone.
	 */
	readonly fields?: string[]

	constructor(
		code: AppErrorCode,
		message?: string,
		options?: { fields?: string[]; cause?: unknown },
	) {
		super(message ?? code, { cause: options?.cause })
		this.code = code
		// An empty array is normalized away so that `fields`, when present, is
		// always meaningful. Otherwise a caller posting a JSON body that isn't an
		// object at all gets `{ error: 'VALIDATION', fields: [] }` — zod reports a
		// top-level issue with no field to attribute it to, so the key would travel
		// carrying no information. `fields` present now means "these fields", and
		// absent means "not attributable".
		this.fields = options?.fields?.length ? options.fields : undefined
		// Without this, every subclass reports `name: 'Error'` in logs.
		this.name = new.target.name
	}
}

/** The request carries no valid session. Maps to 401. */
export class UnauthorizedError extends AppError {
	constructor(message = 'unauthorized', options?: { cause?: unknown }) {
		super('UNAUTHORIZED', message, options)
	}
}

/** Signed in, but not allowed to do this. Maps to 403. */
export class ForbiddenError extends AppError {
	constructor(message = 'forbidden', options?: { cause?: unknown }) {
		super('FORBIDDEN', message, options)
	}
}

/**
 * Maps to 404.
 *
 * Note that services use this for "not found *for this user*" as well — see
 * `core/services/notes-service.ts`. Telling an unauthorized caller apart from a
 * caller asking for something that doesn't exist would leak which ids are real.
 */
export class NotFoundError extends AppError {
	constructor(message = 'not found', options?: { cause?: unknown }) {
		super('NOT_FOUND', message, options)
	}
}

/** Maps to 409. Carry `fields` when it's attributable, e.g. a taken phone. */
export class ConflictError extends AppError {
	constructor(
		message = 'conflict',
		options?: { fields?: string[]; cause?: unknown },
	) {
		super('CONFLICT', message, options)
	}
}

/**
 * Input didn't match its schema. Maps to 400.
 *
 * `core/action.ts` and `core/http.ts` raise this from a failed `safeParse`, so
 * you rarely construct it by hand — do that only for a rule zod can't express
 * (a cross-field invariant, say).
 */
export class ValidationError extends AppError {
	constructor(
		message = 'validation failed',
		options?: { fields?: string[]; cause?: unknown },
	) {
		super('VALIDATION', message, options)
	}
}

/** Maps to 429. Nothing throws this yet — the rate limiter will. */
export class RateLimitedError extends AppError {
	constructor(message = 'rate limited', options?: { cause?: unknown }) {
		super('RATE_LIMITED', message, options)
	}
}

/**
 * Normalizes anything thrown into an `AppError`.
 *
 * A non-`AppError` becomes `INTERNAL` with the original attached as `cause`, so
 * the stack survives into the log even though nothing about it reaches the
 * client.
 */
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) return error
	return new AppError('INTERNAL', 'unexpected error', { cause: error })
}

/**
 * Whether this code means "the caller did something wrong" (4xx) rather than
 * "we did something wrong" (5xx).
 *
 * Used to pick a log level: expected, caller-caused failures are `warn`, and
 * only genuine faults are `error`. Logging validation failures at error level is
 * how an error log stops being worth reading.
 */
export function isClientError(code: AppErrorCode): boolean {
	return code !== 'INTERNAL'
}
