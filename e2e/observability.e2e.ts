import { expect, test } from '@playwright/test'

/**
 * The request-id plumbing and the health endpoint, asserted against a real
 * server.
 *
 * These can't be unit tested: the whole point is that `src/proxy.ts` runs, and
 * the proxy only exists inside a running Next server.
 */

const REQUEST_ID = 'x-request-id'

test.describe('request id', () => {
	test('a page response carries one', async ({ request }) => {
		// Minted by the proxy. This is the id the render sees through headers(), so
		// it's also what shows up on `runAction`'s log lines.
		const response = await request.get('/en/login')

		expect(response.status()).toBe(200)
		expect(response.headers()[REQUEST_ID]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		)
	})

	test('an incoming id is honoured rather than replaced', async ({
		request,
	}) => {
		// What makes our logs join up with a load balancer's or CDN's. Replacing it
		// would break the trace at our front door.
		const response = await request.get('/en/login', {
			headers: { [REQUEST_ID]: 'from-load-balancer-123' },
		})

		expect(response.headers()[REQUEST_ID]).toBe('from-load-balancer-123')
	})

	test('a route handler mints its own, because the proxy skips /api', async ({
		request,
	}) => {
		// The proxy's matcher excludes /api, so withHandler is the only thing that
		// can put an id on an API response — see core/request-id.ts.
		const response = await request.get('/api/health')

		expect(response.headers()[REQUEST_ID]).toBeTruthy()
	})

	test('a route handler honours an incoming id too', async ({ request }) => {
		const response = await request.get('/api/health', {
			headers: { [REQUEST_ID]: 'caller-supplied-456' },
		})

		expect(response.headers()[REQUEST_ID]).toBe('caller-supplied-456')
	})

	test('an error response still carries the id', async ({ request }) => {
		// The case where it matters most: this is the id in the log line that
		// explains the failure.
		const response = await request.patch('/api/notes/not-a-uuid')

		expect(response.status()).toBe(400)
		expect(response.headers()[REQUEST_ID]).toBeTruthy()
	})
})

test.describe('/api/health', () => {
	test('reports ok and round-trips the database', async ({ request }) => {
		const response = await request.get('/api/health')

		expect(response.status()).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})

	test('needs no session', async ({ request }) => {
		// Whatever probes this has no cookies. Asserted explicitly so a future auth
		// change can't quietly make the health check return 401 — which a load
		// balancer would read as "unhealthy" and pull the instance out of rotation.
		const response = await request.get('/api/health', {
			headers: { cookie: '' },
		})

		expect(response.status()).toBe(200)
	})

	test('leaks nothing beyond the status', async ({ request }) => {
		// It's unauthenticated, so the response shape is deliberately fixed: no
		// version, no paths, no reason-for-failure.
		const body = await (await request.get('/api/health')).json()

		expect(Object.keys(body)).toEqual(['status'])
	})
})
