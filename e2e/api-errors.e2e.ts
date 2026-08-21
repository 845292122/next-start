import { expect, test } from '@playwright/test'

/**
 * The HTTP error contract of the route handlers, asserted against the real
 * wired-up routes.
 *
 * `core/http.test.ts` already covers `withHandler` in isolation, but that can't
 * prove the handlers in `app/api/notes/` actually go through it. Every status
 * below was a **500** before the wrapper existed, which is the specific
 * regression this file exists to catch: Route Handlers are the template's only
 * interface for consumers outside this app (see AGENTS.md), and those callers
 * can't read our source to work out that a 500 meant "your JSON was malformed".
 *
 * These run with the signed-in storageState from auth.setup.ts, so a 401 here
 * would mean the session broke rather than the contract.
 */

test.describe('/api/notes error contract', () => {
	test('a body that is not JSON is a 400', async ({ request }) => {
		const response = await request.post('/api/notes', {
			headers: { 'content-type': 'application/json' },
			data: 'not json at all',
		})

		expect(response.status()).toBe(400)
		expect(await response.json()).toEqual({ error: 'VALIDATION' })
	})

	test('an empty body is a 400', async ({ request }) => {
		const response = await request.post('/api/notes', {
			headers: { 'content-type': 'application/json' },
			data: '',
		})

		expect(response.status()).toBe(400)
	})

	test('a body that fails the schema is a 400 naming the field', async ({
		request,
	}) => {
		// An empty title violates createNoteSchema's .min(1).
		const response = await request.post('/api/notes', {
			data: { title: '', body: 'x' },
		})

		expect(response.status()).toBe(400)
		expect(await response.json()).toEqual({
			error: 'VALIDATION',
			fields: ['title'],
		})
	})

	test('a title over the length limit is a 400', async ({ request }) => {
		const response = await request.post('/api/notes', {
			data: { title: 'x'.repeat(201) },
		})

		expect(response.status()).toBe(400)
	})

	test('a valid POST still works', async ({ request }) => {
		// The negative cases above are worthless if the happy path broke with them.
		const response = await request.post('/api/notes', {
			data: { title: `API 契约-${test.info().testId}` },
		})

		expect(response.status()).toBe(201)
		expect(await response.json()).toMatchObject({ done: false })
	})
})

test.describe('/api/notes/[id] error contract', () => {
	// Well-formed, but no such row. Also covers the cross-user case: the service
	// scopes every query by userId, so another user's id lands here too — and it
	// must not be distinguishable from a nonexistent one, or it would leak which
	// ids are real.
	const missingId = '00000000-0000-4000-8000-000000000000'

	test('PATCH on a nonexistent note is a 404, not a 500', async ({
		request,
	}) => {
		const response = await request.patch(`/api/notes/${missingId}`)

		expect(response.status()).toBe(404)
		expect(await response.json()).toEqual({ error: 'NOT_FOUND' })
	})

	test('an id that is not a uuid is a 400, before the database', async ({
		request,
	}) => {
		for (const id of ['abc', '1', 'null']) {
			const response = await request.patch(`/api/notes/${id}`)
			expect(response.status()).toBe(400)
		}
	})

	test('DELETE of a nonexistent note is idempotent', async ({ request }) => {
		// deleteNote issues a scoped DELETE and doesn't check for a row first, so
		// this is a 204 rather than a 404 — asserted so the asymmetry with PATCH
		// above is deliberate and stays that way.
		const response = await request.delete(`/api/notes/${missingId}`)
		expect(response.status()).toBe(204)
	})
})

test.describe('/api/notes pagination contract', () => {
	test('GET returns an envelope with a total, not a bare array', async ({
		request,
	}) => {
		// The published response shape for external consumers. `total` is what lets
		// them know whether to ask for another page; adding it later would have been
		// a breaking change.
		const body = await (await request.get('/api/notes?limit=1')).json()

		expect(Array.isArray(body.items)).toBe(true)
		expect(body.items.length).toBeLessThanOrEqual(1)
		expect(typeof body.total).toBe('number')
	})

	test('limit and offset are honoured', async ({ request }) => {
		// Two notes of our own, so this doesn't depend on what else the suite created.
		const tag = `Paging-${test.info().testId}`
		for (const n of [1, 2]) {
			await request.post('/api/notes', { data: { title: `${tag}-${n}` } })
		}

		const first = await (
			await request.get(`/api/notes?q=${tag}&limit=1`)
		).json()
		const second = await (
			await request.get(`/api/notes?q=${tag}&limit=1&offset=1`)
		).json()

		expect(first.total).toBe(2)
		expect(first.items).toHaveLength(1)
		expect(second.items).toHaveLength(1)
		// Different rows, so offset actually moved the window.
		expect(second.items[0].id).not.toBe(first.items[0].id)
	})

	test('a non-numeric limit is a 400, not a NaN reaching the database', async ({
		request,
	}) => {
		// Query params are strings; this is what listNotesQuerySchema is for.
		const response = await request.get('/api/notes?limit=abc')

		expect(response.status()).toBe(400)
		expect(await response.json()).toMatchObject({ error: 'VALIDATION' })
	})

	test('an over-large limit is refused at the edge', async ({ request }) => {
		expect((await request.get('/api/notes?limit=100000')).status()).toBe(400)
	})
})
