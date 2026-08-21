import pino from 'pino'
import { env } from '@/core/env'

/**
 * Keys whose values never belong in a log file.
 *
 * `phone` is first for a reason: it's this app's *login identity*
 * (core/auth/otp.ts), so it's the one piece of PII that would otherwise show up
 * everywhere. `code` is the verification code.
 *
 * Each name is listed twice — bare and one level deep — because pino's redaction
 * (fast-redact) matches literal paths, and `*` covers exactly one level. Logs
 * here are written as `logger.warn({ action, code }, msg)`, so one level is what
 * the call sites actually produce.
 *
 * **This is key-based, so it is not a guarantee.** A phone number interpolated
 * into an error *message* (`Error: no user for 138...`) is a string, not a keyed
 * value, and redaction can't see it. Don't put user data in exception messages.
 */
const REDACTED_KEYS = [
	'phone',
	'email',
	'code',
	'password',
	'token',
	'secret',
	'authorization',
	'cookie',
]

/**
 * Exported so `logger.test.ts` can assert against the real configuration rather
 * than a copy of it — a redaction list that drifts from the one in use is worse
 * than none, because it reads as covered.
 */
export const redactOptions = {
	paths: [
		...REDACTED_KEYS,
		...REDACTED_KEYS.map((key) => `*.${key}`),
		'req.headers.cookie',
		'req.headers.authorization',
	],
	censor: '[redacted]',
}

// pino's transport spawns a worker thread — do not import this from proxy.ts
// (see the note in that file) or any file with `export const runtime = 'edge'`,
// it will fail to bundle.
export const logger = pino({
	level: env.LOG_LEVEL,
	redact: redactOptions,
	transport:
		env.NODE_ENV === 'development'
			? { target: 'pino-pretty', options: { colorize: true } }
			: undefined,
})

/**
 * A logger that tags every line with the current request's id, so the lines
 * belonging to one request can be pulled out of an interleaved log.
 *
 * See `core/request-id.ts` for where the id comes from.
 */
export function requestLogger(requestId: string | undefined) {
	return requestId ? logger.child({ requestId }) : logger
}

/** Query parameters whose values are credentials, not debugging information. */
const SENSITIVE_PARAMS = new Set([
	'code',
	'state',
	'token',
	'access_token',
	'id_token',
	'secret',
	'password',
	'key',
	'signature',
])

/**
 * Turns a URL into something safe to log: path kept, credential-bearing query
 * values replaced.
 *
 * **Logging a raw URL is a real leak, not a theoretical one.** OAuth redirects
 * back to `/api/auth/callback/...?code=...&state=...`, and that `code` is
 * exchangeable for a session. `core/logger.ts`'s key-based redaction cannot help
 * here — inside a URL string those are characters, not keyed values.
 *
 * The query is preserved rather than dropped wholesale because it's often the
 * only clue about *which* request failed; only the dangerous values are replaced.
 */
export function loggablePath(url: string) {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		// A relative path (which is what instrumentation's `request.path` gives) has
		// no origin to parse against.
		parsed = new URL(url, 'http://placeholder.invalid')
	}

	for (const key of parsed.searchParams.keys()) {
		if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
			parsed.searchParams.set(key, '[redacted]')
		}
	}

	return `${parsed.pathname}${parsed.search}`
}
