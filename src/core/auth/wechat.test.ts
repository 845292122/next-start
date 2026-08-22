import { describe, expect, test } from 'bun:test'

// DATABASE_URL / LOG_LEVEL come from test/unit-setup.ts; the belt-and-braces line
// below covers running this file alone. Dynamic imports for the same reason as
// otp.test.ts.
process.env.DATABASE_URL = ':memory:'

const { runMigrations } = await import('@/core/db/migrate')
const {
	exchangeMiniProgramCode,
	findOrCreateUserByOpenid,
	isWeChatConfigured,
} = await import('@/core/auth/wechat')

await runMigrations()

describe('exchangeMiniProgramCode (stub mode)', () => {
	test('reports that it is not configured', () => {
		// If this ever fails in CI it means credentials leaked into the test env, and
		// the tests below would start making real network calls to WeChat.
		expect(isWeChatConfigured()).toBe(false)
	})

	test('derives a deterministic openid from the code', async () => {
		// Deterministic on purpose: it's what lets e2e sign in twice as "the same
		// user" without credentials.
		const first = await exchangeMiniProgramCode('code-abc')
		const second = await exchangeMiniProgramCode('code-abc')

		expect(first.openid).toBe(second.openid)
	})

	test('different codes give different openids', async () => {
		const a = await exchangeMiniProgramCode('code-a')
		const b = await exchangeMiniProgramCode('code-b')

		expect(a.openid).not.toBe(b.openid)
	})

	test('never returns a real session key', async () => {
		// Guards the stub from being mistaken for the real thing: the actual
		// session_key must never leave the server, and this one is obviously fake.
		const { sessionKey } = await exchangeMiniProgramCode('code-x')

		expect(sessionKey).toContain('stub')
	})
})

describe('findOrCreateUserByOpenid', () => {
	test('creates a user the first time an openid is seen', async () => {
		const user = await findOrCreateUserByOpenid('openid-new')

		expect(user?.id).toBeTruthy()
		expect(user?.openid).toBe('openid-new')
		// Sign-in doubles as sign-up, so there is no name and no phone yet — a WeChat
		// user has neither until they hand one over.
		expect(user?.name).toBeNull()
		expect(user?.phone).toBeNull()
	})

	test('returns the same row on subsequent sign-ins', async () => {
		const first = await findOrCreateUserByOpenid('openid-repeat')
		const second = await findOrCreateUserByOpenid('openid-repeat')

		expect(second.id).toBe(first.id)
	})

	// Guards the onConflictDoNothing upsert, exactly as otp.test.ts does for phone.
	// The obvious select-then-insert version fails here: every caller sees "no such
	// user", they all insert, and all but one die on the `openid` unique index.
	test('concurrent first-time sign-ins for one openid all succeed', async () => {
		const results = await Promise.all(
			Array.from({ length: 8 }, () =>
				findOrCreateUserByOpenid('openid-concurrent'),
			),
		)

		const ids = new Set(results.map((u) => u.id))
		expect(ids.size).toBe(1)
	})

	test('a phone user and an openid user are different accounts', async () => {
		// Documents that the two identities are not linked — see the note on
		// usersTable.openid. Linking them is a feature, not an accident waiting to
		// happen.
		const { findOrCreateUserByPhone } = await import('@/core/auth/otp')

		const byPhone = await findOrCreateUserByPhone('13700000001')
		const byOpenid = await findOrCreateUserByOpenid('openid-unlinked')

		expect(byOpenid.id).not.toBe(byPhone.id)
	})
})

describe('exchangeMiniProgramCode (real path)', () => {
	/**
	 * Credentials are injected and `fetch` is stubbed, so this exercises the branch
	 * that runs in production without ever contacting WeChat.
	 *
	 * `global.fetch` is replaced rather than `mock.module`'d: module mocks in bun are
	 * process-wide and would leak into every other test file (see the note in
	 * wechat.ts), whereas this is restored in a `finally`.
	 */
	async function withStubbedFetch<T>(
		body: unknown,
		run: () => Promise<T>,
	): Promise<T> {
		const original = global.fetch
		// `as unknown as typeof fetch` because the real signature carries extras
		// (`preconnect`) that a stub has no reason to implement.
		global.fetch = (async () =>
			new Response(JSON.stringify(body), {
				// 200 on purpose — see below.
				status: 200,
				headers: { 'content-type': 'application/json' },
			})) as unknown as typeof fetch
		try {
			return await run()
		} finally {
			global.fetch = original
		}
	}

	const credentials = { appid: 'test-appid', secret: 'test-secret' }

	test('reports configured when credentials are injected', () => {
		expect(isWeChatConfigured(credentials)).toBe(true)
	})

	test('returns the openid and session key on success', async () => {
		const session = await withStubbedFetch(
			{ openid: 'real-openid', session_key: 'real-key', unionid: 'u-1' },
			() => exchangeMiniProgramCode('code-real', credentials),
		)

		expect(session).toEqual({
			openid: 'real-openid',
			sessionKey: 'real-key',
			unionid: 'u-1',
		})
	})

	test('treats an errcode as failure even though the status is 200', async () => {
		// The counterintuitive part of WeChat's API and the single most likely thing to
		// get wrong: a rejected code comes back as HTTP 200 with `errcode` in the body.
		// Checking `response.ok` would happily accept this and then blow up on a
		// missing openid somewhere further down.
		//
		// 40029 is "invalid code", the everyday case — a 401, not a 500.
		const failing = withStubbedFetch(
			{ errcode: 40029, errmsg: 'invalid code' },
			() => exchangeMiniProgramCode('expired-code', credentials),
		)

		expect(failing).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
	})

	test('rejects a 200 response that is missing the fields we need', async () => {
		// Defensive: a shape change upstream must not produce a user with
		// `openid: undefined`.
		expect(
			withStubbedFetch({ openid: 'x' }, () =>
				exchangeMiniProgramCode('half-a-response', credentials),
			),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
	})

	test('does not leak the code into the thrown error', async () => {
		// The code is a credential. `core/logger.ts` redacts the `code` *key*, but an
		// interpolated string would sail straight through — see the documented
		// limitation in logger.test.ts.
		let caught: unknown
		try {
			await withStubbedFetch({ errcode: 40029, errmsg: 'invalid code' }, () =>
				exchangeMiniProgramCode('super-secret-code', credentials),
			)
		} catch (error) {
			caught = error
		}

		expect(String((caught as Error).message)).not.toContain('super-secret-code')
	})
})
