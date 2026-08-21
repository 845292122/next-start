import { describe, expect, test } from 'bun:test'
import pino from 'pino'
import { loggablePath, redactOptions } from '@/core/logger'

/**
 * Asserts the redaction configuration actually redacts.
 *
 * A pino instance is built here over an in-memory sink rather than reusing the
 * exported `logger`: that one writes to stdout (through pino-pretty in
 * development), so there'd be nothing to assert on. The *config* under test is
 * the real one — `redactOptions` is the same object `core/logger.ts` passes to
 * pino.
 */
function captureLog(payload: Record<string, unknown>) {
	const lines: string[] = []
	const log = pino(
		{ redact: redactOptions },
		{ write: (line: string) => lines.push(line) },
	)
	log.info(payload, 'test')
	return lines.join('')
}

describe('log redaction', () => {
	test('redacts the login identity at the top level', () => {
		// `phone` is this app's login identity (core/auth/otp.ts), so it's the piece
		// of PII most likely to end up in a log line.
		const output = captureLog({ phone: '13800000000', action: 'signIn' })

		expect(output).not.toContain('13800000000')
		expect(output).toContain('[redacted]')
		// Non-sensitive fields have to survive, or the log is useless.
		expect(output).toContain('signIn')
	})

	test('redacts one level deep, which is the shape call sites produce', () => {
		// Logs are written as `logger.warn({ action, err }, msg)`, so nested-by-one
		// is what actually occurs.
		const output = captureLog({ user: { phone: '13900000001', id: 'u1' } })

		expect(output).not.toContain('13900000001')
		expect(output).toContain('u1')
	})

	test.each([
		['email', 'someone@example.com'],
		['code', '123456'],
		['password', 'hunter2'],
		['token', 'eyJhbGciOi'],
		['secret', 'sk-live-abc'],
		['authorization', 'Bearer abc123'],
		['cookie', 'authjs.session-token=xyz'],
	])('redacts %s', (key, value) => {
		expect(captureLog({ [key]: value })).not.toContain(value)
		expect(captureLog({ nested: { [key]: value } })).not.toContain(value)
	})

	test('redacts request headers under the pino `req` convention', () => {
		const output = captureLog({
			req: { headers: { cookie: 'authjs.session-token=xyz', host: 'x.test' } },
		})

		expect(output).not.toContain('authjs.session-token')
		expect(output).toContain('x.test')
	})

	test('does NOT catch sensitive data inside a message string', () => {
		// The documented limitation, asserted so nobody mistakes key-based
		// redaction for a guarantee. Redaction matches keyed values; a phone number
		// interpolated into an error message is just characters. The rule that
		// follows from this: don't put user data in exception messages.
		const output = captureLog({
			err: { message: 'no user for 13800000000' },
		})

		expect(output).toContain('13800000000')
	})
})

describe('loggablePath', () => {
	test('strips the OAuth authorization code', () => {
		// The concrete leak this exists for: that `code` is exchangeable for a
		// session, and `onRequestError` sees every route including this one.
		const safe = loggablePath(
			'https://app.test/api/auth/callback/wechat?code=SECRET_GRANT&state=SECRET_STATE',
		)

		expect(safe).not.toContain('SECRET_GRANT')
		expect(safe).not.toContain('SECRET_STATE')
		expect(safe).toContain('/api/auth/callback/wechat')
	})

	test('keeps harmless parameters, because they are the debugging clue', () => {
		const safe = loggablePath('https://app.test/api/notes?q=hello&page=2')

		expect(safe).toBe('/api/notes?q=hello&page=2')
	})

	test('drops the origin', () => {
		// Host and port belong to the deployment, not to the failure.
		expect(loggablePath('https://app.test:8443/notes')).toBe('/notes')
	})

	test('handles a relative path, which is what instrumentation provides', () => {
		// `request.path` from onRequestError has no origin to parse against.
		expect(loggablePath('/api/auth/callback/x?code=SECRET')).toBe(
			'/api/auth/callback/x?code=%5Bredacted%5D',
		)
	})

	test('is case-insensitive about parameter names', () => {
		expect(loggablePath('/cb?Code=SECRET&TOKEN=SECRET2')).not.toContain(
			'SECRET',
		)
	})
})
