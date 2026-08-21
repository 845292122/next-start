import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// LOG_LEVEL is set to `fatal` for the whole unit run by test/unit-setup.ts
// (--preload). It cannot be set here: core/logger.ts reads it off the frozen `env`
// object, so whichever file imports @/core/env first wins — see the comment in
// that preload.

const {
	AppError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	RateLimitedError,
	UnauthorizedError,
	ValidationError,
} = await import('@/core/errors')
const { readJson, readParams, withHandler } = await import('@/core/http')

function get(url = 'http://localhost/api/test') {
	return new Request(url)
}

function post(body: string, url = 'http://localhost/api/test') {
	return new Request(url, { method: 'POST', body })
}

describe('withHandler status mapping', () => {
	test.each([
		[new ValidationError(), 400, 'VALIDATION'],
		[new UnauthorizedError(), 401, 'UNAUTHORIZED'],
		[new ForbiddenError(), 403, 'FORBIDDEN'],
		[new NotFoundError(), 404, 'NOT_FOUND'],
		[new ConflictError(), 409, 'CONFLICT'],
		[new RateLimitedError(), 429, 'RATE_LIMITED'],
	] as const)('%o becomes %i', async (error, status, code) => {
		const handler = withHandler(async () => {
			throw error
		})

		const response = await handler(get(), undefined)

		expect(response.status).toBe(status)
		expect(await response.json()).toEqual({ error: code })
	})

	test('an unexpected throw becomes a 500 and leaks nothing', async () => {
		// This is the pair of guarantees that matters: the caller learns the request
		// failed, and learns nothing about why.
		const handler = withHandler(async () => {
			throw new TypeError('SQLITE_BUSY: database is locked at /srv/data/dev.db')
		})

		const response = await handler(get(), undefined)
		const body = await response.text()

		expect(response.status).toBe(500)
		expect(JSON.parse(body)).toEqual({ error: 'INTERNAL' })
		expect(body).not.toContain('SQLITE_BUSY')
		expect(body).not.toContain('/srv/data')
	})

	test('field names travel with the error', async () => {
		const handler = withHandler(async () => {
			throw new ConflictError('taken', { fields: ['phone'] })
		})

		const response = await handler(get(), undefined)

		expect(response.status).toBe(409)
		expect(await response.json()).toEqual({
			error: 'CONFLICT',
			fields: ['phone'],
		})
	})

	test('a successful response passes through untouched', async () => {
		const handler = withHandler(async () =>
			Response.json({ hello: 'world' }, { status: 201 }),
		)

		const response = await handler(get(), undefined)

		expect(response.status).toBe(201)
		expect(await response.json()).toEqual({ hello: 'world' })
	})

	test('the context argument reaches the handler unchanged', async () => {
		const handler = withHandler<{ params: Promise<{ id: string }> }>(
			async (_request, { params }) => Response.json(await params),
		)

		const response = await handler(get(), {
			params: Promise.resolve({ id: 'abc' }),
		})

		expect(await response.json()).toEqual({ id: 'abc' })
	})

	test("Next's control-flow errors are rethrown, not turned into a 500", async () => {
		// The regression this guards: `notFound()` and `redirect()` work by throwing
		// an internal Next error. A try/catch this broad swallows them unless
		// unstable_rethrow() runs first — and the symptom is silent, a redirect that
		// simply doesn't happen. See core/http.ts.
		const { notFound } = await import('next/navigation')

		// `async () => notFound()` rather than a block body: notFound() returns
		// `never`, so this infers Promise<never> and satisfies the handler's
		// Promise<Response>. A block body would infer Promise<void> and fail
		// typecheck.
		const handler = withHandler(async () => notFound())

		expect(handler(get(), undefined)).rejects.toThrow()
	})
})

describe('readJson', () => {
	const schema = z.object({ title: z.string().min(1) })

	test('returns the parsed body', async () => {
		expect(await readJson(post('{"title":"hi"}'), schema)).toEqual({
			title: 'hi',
		})
	})

	test('a body that is not JSON is a VALIDATION error, not a crash', async () => {
		// `request.json()` throws a SyntaxError here. Before this helper existed it
		// escaped the handler and came back as a 500.
		expect(readJson(post('not json at all'), schema)).rejects.toMatchObject({
			code: 'VALIDATION',
		})
	})

	test('an empty body is a VALIDATION error', async () => {
		// The easiest way to hit the SyntaxError path: POST with no body at all.
		expect(readJson(post(''), schema)).rejects.toMatchObject({
			code: 'VALIDATION',
		})
	})

	test('a body that parses but fails the schema reports its fields', async () => {
		expect(readJson(post('{"title":""}'), schema)).rejects.toMatchObject({
			code: 'VALIDATION',
			fields: ['title'],
		})
	})

	test('through withHandler, all of the above are 400s', async () => {
		const handler = withHandler(async (request) => {
			const body = await readJson(request, schema)
			return Response.json(body)
		})

		for (const body of ['', 'not json', '{"title":""}', '[]', 'null']) {
			const response = await handler(post(body), undefined)
			expect(response.status).toBe(400)
		}
	})

	test('a body that is not an object reports no fields at all', async () => {
		// zod raises a top-level issue here, with no field to attribute it to. The
		// response must omit `fields` rather than send an empty array — see the
		// normalization in core/errors.ts.
		const handler = withHandler(async (request) => {
			const body = await readJson(request, schema)
			return Response.json(body)
		})

		for (const body of ['[]', 'null', '"a string"', '42']) {
			const response = await handler(post(body), undefined)
			expect(response.status).toBe(400)
			expect(await response.json()).toEqual({ error: 'VALIDATION' })
		}
	})
})

describe('readParams', () => {
	const schema = z.object({ id: z.uuid() })

	test('accepts a real uuid', async () => {
		const id = crypto.randomUUID()
		expect(await readParams(Promise.resolve({ id }), schema)).toEqual({ id })
	})

	test('rejects anything that is not one', async () => {
		// Route params are arbitrary strings — this is what keeps a hand-typed id
		// from reaching the database.
		for (const id of ['', 'abc', '../../etc/passwd', '1 OR 1=1']) {
			expect(
				readParams(Promise.resolve({ id }), schema),
			).rejects.toBeInstanceOf(AppError)
		}
	})
})
