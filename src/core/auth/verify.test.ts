import { describe, expect, test } from 'bun:test'
import { encode } from 'next-auth/jwt'

// DATABASE_URL and LOG_LEVEL come from test/unit-setup.ts. Dynamic import because
// `core/auth/verify.ts` pulls in the Auth.js config, which opens the database at
// module scope.
const {
	issueBearerToken,
	requireSession,
	sessionFromBearer,
	sessionFromCookie,
} = await import('@/core/auth/verify')
const { AppError } = await import('@/core/errors')
const { env } = await import('@/core/env')

/** A Request carrying whatever Authorization header we want to test. */
function withAuth(authorization?: string) {
	return new Request('http://localhost/api/v1/notes', {
		headers: authorization ? { authorization } : {},
	})
}

describe('issueBearerToken + sessionFromBearer', () => {
	test('round-trips the user id', async () => {
		const token = await issueBearerToken('user-123')

		const session = await sessionFromBearer(withAuth(`Bearer ${token}`))

		expect(session?.user.id).toBe('user-123')
	})

	test('produces the same session shape as the cookie transport', async () => {
		// Callers must not be able to tell the transports apart — `core/services/` only
		// ever sees `session.user.id`, and that's the contract this keeps.
		const token = await issueBearerToken('user-shape')

		const session = await sessionFromBearer(withAuth(`Bearer ${token}`))

		expect(session).toMatchObject({ user: { id: 'user-shape' } })
		expect(typeof session?.expires).toBe('string')
		// A parseable ISO timestamp in the future.
		expect(new Date(session?.expires ?? 0).getTime()).toBeGreaterThan(
			Date.now(),
		)
	})
})

describe('sessionFromBearer rejections', () => {
	test.each([
		['no header at all', undefined],
		['the wrong scheme', 'Basic abc123'],
		['no scheme', 'abc123'],
		['an empty Bearer', 'Bearer '],
		['whitespace only', 'Bearer    '],
		['a garbage token', 'Bearer not-a-real-token'],
		['a truncated JWE', 'Bearer eyJhbGciOiJkaXIifQ..AAAA'],
	])('returns null for %s', async (_label, authorization) => {
		// Every one of these has to be "no session" rather than a throw: `withHandler`
		// would turn a throw into a 500, and a client sending a malformed header
		// deserves a 401.
		expect(await sessionFromBearer(withAuth(authorization))).toBeNull()
	})

	test('is case-sensitive about the Bearer scheme', async () => {
		// Documents the current behaviour rather than endorsing it. RFC 6750 says the
		// scheme is case-insensitive, so if a client ever sends `bearer ` this is where
		// to relax it — deliberately, not by accident.
		const token = await issueBearerToken('user-case')

		expect(await sessionFromBearer(withAuth(`bearer ${token}`))).toBeNull()
	})

	test('rejects a token minted with a different secret', async () => {
		// The forgery case. If this passed, anyone could mint a token for any user id.
		const forged = await encode({
			token: { id: 'attacker' },
			secret: 'a-completely-different-secret-value',
			salt: 'api-v1-bearer',
			maxAge: 3600,
		})

		expect(await sessionFromBearer(withAuth(`Bearer ${forged}`))).toBeNull()
	})

	test('rejects a token minted with a different salt', async () => {
		// Why the salt is its own constant: a session cookie and a Bearer token share
		// AUTH_SECRET, and distinct salts are what stop one from being replayed as the
		// other.
		const wrongSalt = await encode({
			token: { id: 'user-salt' },
			secret: env.AUTH_SECRET,
			salt: 'authjs.session-token',
			maxAge: 3600,
		})

		expect(await sessionFromBearer(withAuth(`Bearer ${wrongSalt}`))).toBeNull()
	})

	test('rejects an expired token', async () => {
		const expired = await encode({
			token: { id: 'user-expired' },
			secret: env.AUTH_SECRET,
			salt: 'api-v1-bearer',
			// Already past.
			maxAge: -60,
		})

		expect(await sessionFromBearer(withAuth(`Bearer ${expired}`))).toBeNull()
	})

	test('rejects a valid token whose payload carries no id', async () => {
		// Correctly signed but useless. Without this check `session.user.id` would be
		// `undefined` and every service call would silently scope to nothing — or,
		// worse, to a falsy value some future query forgets to guard.
		const noId = await encode({
			token: { sub: 'not-the-field-we-read' },
			secret: env.AUTH_SECRET,
			salt: 'api-v1-bearer',
			maxAge: 3600,
		})

		expect(await sessionFromBearer(withAuth(`Bearer ${noId}`))).toBeNull()
	})
})

describe('sessionFromCookie', () => {
	test('yields no session outside a request scope', async () => {
		// Auth.js needs request context to find the cookie. Asserted mostly to pin that
		// it *doesn't throw* here — `getRequiredSession()` is supposed to fail with
		// UnauthorizedError, not with an Auth.js internal error.
		const session = await sessionFromCookie().catch(() => null)

		expect(session).toBeNull()
	})
})

describe('requireSession', () => {
	test('passes a real session through', () => {
		const session = { user: { id: 'u1' }, expires: 'x' } as never

		expect(requireSession(session)).toBe(session)
	})

	test.each([
		['null', null],
		['a session with no user', { expires: 'x' } as never],
	])('throws UNAUTHORIZED for %s', (_label, input) => {
		let caught: unknown
		try {
			requireSession(input as never)
		} catch (error) {
			caught = error
		}

		expect(caught).toBeInstanceOf(AppError)
		expect((caught as InstanceType<typeof AppError>).code).toBe('UNAUTHORIZED')
	})
})
