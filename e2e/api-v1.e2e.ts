import { expect, test } from '@playwright/test'

/**
 * `/api/v1` — the Bearer-only surface the WeChat mini program uses.
 *
 * The load-bearing test in this file is `refuses a cookie-authenticated request`.
 * Everything else here would still pass if someone "helpfully" made
 * `getRequiredBearerSession` fall back to the cookie — and that change would
 * silently reintroduce a CSRF surface, because a browser attaches the session cookie
 * to cross-site requests under `SameSite=Lax` for top-level navigations and the
 * whole argument in DEVELOPMENT.md § 安全 rests on this endpoint not accepting it.
 *
 * Runs with the default (signed-in) storageState on purpose: the cookie is present
 * in the context, so a request that authenticates via cookie *would* succeed. That's
 * what makes the 401 meaningful.
 */

/** A code is opaque to us; with no WeChat credentials the stub derives an openid. */
function uniqueCode(label: string) {
	return `${label}-${test.info().testId}`
}

async function signIn(
	request: import('@playwright/test').APIRequestContext,
	code: string,
) {
	const response = await request.post('/api/v1/auth/wechat', { data: { code } })
	expect(response.status()).toBe(201)
	return (await response.json()) as {
		token: string
		user: { id: string }
		stub?: boolean
	}
}

test.describe('POST /api/v1/auth/wechat', () => {
	test('mints a token and creates the user on first sign-in', async ({
		request,
	}) => {
		const body = await signIn(request, uniqueCode('first'))

		expect(body.token).toBeTruthy()
		expect(body.user.id).toBeTruthy()
		// Flags that no WeChat credentials are configured — see core/auth/wechat.ts.
		expect(body.stub).toBe(true)
	})

	test('the same code resolves to the same user', async ({ request }) => {
		// Sign-in doubles as sign-up, and the stub openid is derived from the code, so
		// this exercises findOrCreateUserByOpenid's insert-first path twice.
		const code = uniqueCode('same')
		const first = await signIn(request, code)
		const second = await signIn(request, code)

		expect(second.user.id).toBe(first.user.id)
	})

	test('different codes are different users', async ({ request }) => {
		const a = await signIn(request, uniqueCode('a'))
		const b = await signIn(request, uniqueCode('b'))

		expect(b.user.id).not.toBe(a.user.id)
	})

	test('a missing code is a 400, not a 500', async ({ request }) => {
		const response = await request.post('/api/v1/auth/wechat', { data: {} })

		expect(response.status()).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION',
			fields: ['code'],
		})
	})
})

test.describe('GET /api/v1/notes authentication', () => {
	test('refuses a cookie-authenticated request', async ({ request }) => {
		// ⚠️ The test this file exists for.
		//
		// The browser context is signed in, so this request carries the Auth.js session
		// cookie — the very cookie `/api/notes` accepts. This surface must not: it is
		// Bearer-only, and that is what makes it CSRF-free by construction. A 200 here
		// means someone merged the two transports.
		const response = await request.get('/api/v1/notes')

		expect(response.status()).toBe(401)
		expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' })
	})

	test('accepts a Bearer token', async ({ request }) => {
		const { token } = await signIn(request, uniqueCode('bearer'))

		const response = await request.get('/api/v1/notes', {
			headers: { authorization: `Bearer ${token}` },
		})

		expect(response.status()).toBe(200)
		const body = await response.json()
		expect(Array.isArray(body.items)).toBe(true)
		expect(typeof body.total).toBe('number')
	})

	test('refuses malformed or wrong-scheme credentials', async ({ request }) => {
		// Each of these must be a plain 401, not a 500: a header a client got wrong is
		// the caller's mistake, and `sessionFromBearer` has to treat every shape of
		// garbage as "no session" rather than throwing.
		for (const authorization of [
			'Bearer not-a-real-token',
			'Basic abc123',
			'Bearer ',
			'abc123',
		]) {
			const response = await request.get('/api/v1/notes', {
				headers: { authorization },
			})

			expect(response.status(), `authorization: ${authorization}`).toBe(401)
		}
	})

	test('a token signed with a different secret is refused', async ({
		request,
	}) => {
		// Structurally valid JWE, wrong key. Guards against a decode path that trusts
		// the payload without verifying — which would make forging a user id trivial.
		const forged =
			'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..AAAAAAAAAAAAAAAA.AAAA.AAAAAAAAAAAAAAAA'

		const response = await request.get('/api/v1/notes', {
			headers: { authorization: `Bearer ${forged}` },
		})

		expect(response.status()).toBe(401)
	})
})

test.describe('GET /api/v1/notes data scoping', () => {
	test('a token only sees its own rows', async ({ request }) => {
		// The guarantee that matters most for a multi-client API: the service scopes
		// every query by userId, so one mini program user cannot read another's notes
		// even though both hit the same route.
		const alice = await signIn(request, uniqueCode('alice'))
		const bob = await signIn(request, uniqueCode('bob'))

		const created = await request.post('/api/v1/notes', {
			headers: { authorization: `Bearer ${alice.token}` },
			data: { title: `Alice's note ${test.info().testId}` },
		})
		expect(created.status()).toBe(201)

		const bobsList = await request.get('/api/v1/notes', {
			headers: { authorization: `Bearer ${bob.token}` },
		})

		expect(bobsList.status()).toBe(200)
		// Bob is a brand-new user, so his list is empty regardless of Alice's writes.
		expect((await bobsList.json()).total).toBe(0)
	})

	test('the seeded web user’s notes are not visible to a mini program user', async ({
		request,
	}) => {
		// The two transports resolve to *different* users here (the seed user signs in
		// by phone, this one by openid), so this also documents that phone and openid
		// identities are not linked — see the note on usersTable.openid.
		const fresh = await signIn(request, uniqueCode('isolated'))

		const response = await request.get('/api/v1/notes', {
			headers: { authorization: `Bearer ${fresh.token}` },
		})

		expect((await response.json()).total).toBe(0)
	})
})

test.describe('/api/v1 error contract', () => {
	test('shares the wrapper, so a bad body is a 400', async ({ request }) => {
		const { token } = await signIn(request, uniqueCode('badbody'))

		const response = await request.post('/api/v1/notes', {
			headers: { authorization: `Bearer ${token}` },
			data: { title: '' },
		})

		expect(response.status()).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION',
			fields: ['title'],
		})
	})

	test('carries a request id like every other handler', async ({ request }) => {
		const response = await request.get('/api/v1/notes')
		expect(response.headers()['x-request-id']).toBeTruthy()
	})
})
