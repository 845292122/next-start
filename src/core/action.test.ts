import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Session } from 'next-auth'
import { z } from 'zod'

// See core/http.test.ts — suppresses the wrappers' own warn/error output.
process.env.LOG_LEVEL = 'fatal'

const FAKE_SESSION = {
	user: { id: 'user-1', name: null, email: null, image: null },
	expires: '2099-01-01T00:00:00.000Z',
} as unknown as Session

let session: Session | null = FAKE_SESSION

/**
 * `getRequiredSession` is mocked rather than exercised for real: the real one
 * pulls in the Auth.js config, the Drizzle adapter and the database client, none
 * of which this suite is about. Mocking it also keeps `core/action.ts` off the
 * heavy import chain, which is why this is registered *before* the dynamic
 * import below — a static `import` would be hoisted above it and load the real
 * module first.
 */
mock.module('@/core/auth/session', () => ({
	getRequiredSession: async () => {
		const { UnauthorizedError } = await import('@/core/errors')
		if (!session?.user) throw new UnauthorizedError()
		return session
	},
}))

const { runAction, runPublicAction } = await import('@/core/action')
const { ConflictError } = await import('@/core/errors')

const schema = z.object({
	title: z.string().min(1),
	body: z.string().default(''),
})

beforeEach(() => {
	session = FAKE_SESSION
})

describe('runAction', () => {
	test('returns ok with the handler result', async () => {
		const result = await runAction({
			name: 'test',
			schema,
			input: { title: 'hello' },
			handler: async (input, s) => ({ title: input.title, userId: s.user.id }),
		})

		expect(result).toEqual({
			ok: true,
			data: { title: 'hello', userId: 'user-1' },
		})
	})

	test('hands the handler the parsed output, with defaults applied', async () => {
		const result = await runAction({
			name: 'test',
			schema,
			input: { title: 'hello' },
			handler: async (input) => input,
		})

		// `body` is optional on the way in and always present on the way out —
		// that's the whole reason schema.ts exports both input and output types.
		expect(result).toEqual({ ok: true, data: { title: 'hello', body: '' } })
	})

	test('no session becomes UNAUTHORIZED and the handler never runs', async () => {
		session = null
		const handler = mock(async () => 'should not happen')

		const result = await runAction({
			name: 'test',
			schema,
			input: { title: 'hello' },
			handler,
		})

		expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED' })
		expect(handler).not.toHaveBeenCalled()
	})

	test('invalid input becomes VALIDATION with the offending fields', async () => {
		const result = await runAction({
			name: 'test',
			schema,
			input: { title: '' },
			handler: async () => 'unreachable',
		})

		expect(result).toEqual({
			ok: false,
			code: 'VALIDATION',
			fields: ['title'],
		})
	})

	test('the session is checked before the input is parsed', async () => {
		// Deliberate ordering, not incidental: an unauthenticated caller must not be
		// able to probe the schema by watching whether they get UNAUTHORIZED or
		// VALIDATION back.
		session = null

		const result = await runAction({
			name: 'test',
			schema,
			input: { title: '', nonsense: true },
			handler: async () => 'unreachable',
		})

		expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED' })
	})

	test('an AppError from the handler keeps its code and fields', async () => {
		const result = await runAction({
			name: 'test',
			schema,
			input: { title: 'hello' },
			handler: async () => {
				throw new ConflictError('taken', { fields: ['title'] })
			},
		})

		expect(result).toEqual({
			ok: false,
			code: 'CONFLICT',
			fields: ['title'],
		})
	})

	test('an unexpected throw becomes INTERNAL and leaks nothing', async () => {
		const result = await runAction({
			name: 'test',
			schema,
			input: { title: 'hello' },
			handler: async () => {
				throw new TypeError('SQLITE_BUSY at /srv/data/dev.db')
			},
		})

		expect(result).toEqual({ ok: false, code: 'INTERNAL' })
		// Nothing about the cause may appear in the value handed to the client.
		expect(JSON.stringify(result)).not.toContain('SQLITE_BUSY')
		expect(JSON.stringify(result)).not.toContain('/srv/data')
	})

	test("Next's control-flow errors are rethrown, not swallowed", async () => {
		// The regression this guards is silent: `redirect()` throws an internal Next
		// error, and without unstable_rethrow() the wrapper would report
		// `{ ok: false, code: 'INTERNAL' }` while the navigation simply never
		// happened. See core/action.ts.
		const { redirect } = await import('next/navigation')

		expect(
			runAction({
				name: 'test',
				schema,
				input: { title: 'hello' },
				handler: async () => redirect('/somewhere'),
			}),
		).rejects.toThrow()
	})
})

describe('runPublicAction', () => {
	test('runs with no session at all', async () => {
		session = null

		const result = await runPublicAction({
			name: 'publicTest',
			schema,
			input: { title: 'hello' },
			handler: async (input) => input.title,
		})

		expect(result).toEqual({ ok: true, data: 'hello' })
	})

	test('still validates its input', async () => {
		session = null

		const result = await runPublicAction({
			name: 'publicTest',
			schema,
			input: {},
			handler: async () => 'unreachable',
		})

		expect(result).toEqual({
			ok: false,
			code: 'VALIDATION',
			fields: ['title'],
		})
	})
})
