import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { AppError } from '@/core/errors'
import { parseOrThrow } from '@/core/validation'

const schema = z.object({
	title: z.string().min(1).max(10),
	count: z.number(),
})

describe('parseOrThrow', () => {
	test('returns the parsed output, with defaults applied', () => {
		const withDefault = z.object({ body: z.string().default('') })
		expect(parseOrThrow(withDefault, {})).toEqual({ body: '' })
	})

	test('raises a VALIDATION AppError rather than a raw ZodError', () => {
		// The whole point: a bare `schema.parse()` throws a ZodError, which the
		// wrappers can't classify and therefore report as a 500.
		let caught: unknown
		try {
			parseOrThrow(schema, { title: '', count: 'nope' })
		} catch (error) {
			caught = error
		}

		expect(caught).toBeInstanceOf(AppError)
		expect((caught as AppError).code).toBe('VALIDATION')
	})

	test('reports which fields failed, and only those', () => {
		let caught: AppError | undefined
		try {
			parseOrThrow(schema, { title: '', count: 5 })
		} catch (error) {
			caught = error as AppError
		}

		expect(caught?.fields).toEqual(['title'])
	})

	test('carries no zod message text on the error itself', () => {
		// Zod's built-in messages are English, and schemas here deliberately carry
		// no locale-specific text (see core/auth/schema.ts). Only field *names* may
		// travel to the client; the detail stays on `cause`, for the log.
		let caught: AppError | undefined
		try {
			parseOrThrow(schema, { title: '', count: 5 })
		} catch (error) {
			caught = error as AppError
		}

		expect(caught?.message).not.toContain('Too small')
		expect(caught?.cause).toBeInstanceOf(z.ZodError)
	})

	test('a non-object input still yields fields rather than crashing', () => {
		// `readJson` can hand this a string or null when a caller posts junk.
		expect(() => parseOrThrow(schema, null)).toThrow(AppError)
		expect(() => parseOrThrow(schema, 'not an object')).toThrow(AppError)
	})
})
