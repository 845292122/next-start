import { describe, expect, test } from 'bun:test'
import {
	AppError,
	ConflictError,
	ForbiddenError,
	isClientError,
	NotFoundError,
	RateLimitedError,
	toAppError,
	UnauthorizedError,
	ValidationError,
} from '@/core/errors'

describe('AppError', () => {
	test('every subclass reports its own name and code', () => {
		// Without `this.name = new.target.name` in the base constructor these would
		// all log as `Error`, which makes a stack trace in production useless.
		expect([
			new UnauthorizedError(),
			new ForbiddenError(),
			new NotFoundError(),
			new ConflictError(),
			new ValidationError(),
			new RateLimitedError(),
		]).toEqual([
			expect.objectContaining({
				name: 'UnauthorizedError',
				code: 'UNAUTHORIZED',
			}),
			expect.objectContaining({ name: 'ForbiddenError', code: 'FORBIDDEN' }),
			expect.objectContaining({ name: 'NotFoundError', code: 'NOT_FOUND' }),
			expect.objectContaining({ name: 'ConflictError', code: 'CONFLICT' }),
			expect.objectContaining({ name: 'ValidationError', code: 'VALIDATION' }),
			expect.objectContaining({
				name: 'RateLimitedError',
				code: 'RATE_LIMITED',
			}),
		])
	})

	test('subclasses are catchable as AppError', () => {
		// The wrappers in core/action.ts and core/http.ts do exactly one
		// `instanceof AppError` check, so this is what makes the hierarchy usable.
		expect(new NotFoundError()).toBeInstanceOf(AppError)
		expect(new NotFoundError()).toBeInstanceOf(Error)
	})

	test('carries field names for attributable failures', () => {
		const error = new ConflictError('phone already registered', {
			fields: ['phone'],
		})
		expect(error.fields).toEqual(['phone'])
	})

	test('an empty fields array is normalized to undefined', () => {
		// So that `fields` present always means something. A JSON body that isn't an
		// object produces a zod error with no field-level issues, and shipping
		// `fields: []` to the client would be a key carrying no information.
		expect(new ValidationError('x', { fields: [] }).fields).toBeUndefined()
	})
})

describe('toAppError', () => {
	test('passes an AppError through unchanged', () => {
		const original = new NotFoundError('note not found')
		expect(toAppError(original)).toBe(original)
	})

	test('wraps anything else as INTERNAL and keeps the original as cause', () => {
		// The original has to survive as `cause` — it's the only way the real stack
		// reaches the log, given that nothing about it reaches the client.
		const thrown = new TypeError('db driver exploded')
		const wrapped = toAppError(thrown)

		expect(wrapped.code).toBe('INTERNAL')
		expect(wrapped.cause).toBe(thrown)
		// And the driver's message must not become the outward-facing one.
		expect(wrapped.message).not.toContain('db driver exploded')
	})

	test('handles non-Error throws', () => {
		expect(toAppError('just a string').code).toBe('INTERNAL')
		expect(toAppError(undefined).code).toBe('INTERNAL')
	})
})

describe('isClientError', () => {
	// This is what picks the log level: caller-caused failures are warn, genuine
	// faults are error. Logging validation failures at error level is how an error
	// log stops being worth reading.
	test('only INTERNAL counts as our fault', () => {
		expect(isClientError('VALIDATION')).toBe(true)
		expect(isClientError('UNAUTHORIZED')).toBe(true)
		expect(isClientError('FORBIDDEN')).toBe(true)
		expect(isClientError('NOT_FOUND')).toBe(true)
		expect(isClientError('CONFLICT')).toBe(true)
		expect(isClientError('RATE_LIMITED')).toBe(true)
		expect(isClientError('INTERNAL')).toBe(false)
	})
})
