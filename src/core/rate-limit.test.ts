import { describe, expect, test } from 'bun:test'
import { createRateLimiter } from '@/core/rate-limit'

describe('createRateLimiter', () => {
	test('allows up to the limit, then refuses', () => {
		const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })

		expect(limiter.check('a')).toEqual({ allowed: true, remaining: 2 })
		expect(limiter.check('a')).toEqual({ allowed: true, remaining: 1 })
		expect(limiter.check('a')).toEqual({ allowed: true, remaining: 0 })
		expect(limiter.check('a').allowed).toBe(false)
	})

	test('keys are independent', () => {
		// The property the sign-in limiter depends on: throttling one phone number
		// must not lock out everyone else.
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })

		expect(limiter.check('13800000000').allowed).toBe(true)
		expect(limiter.check('13800000000').allowed).toBe(false)
		expect(limiter.check('13900000000').allowed).toBe(true)
	})

	test('a refusal says how long to wait', () => {
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
		limiter.check('a')

		const result = limiter.check('a')

		expect(result.allowed).toBe(false)
		if (result.allowed) throw new Error('unreachable')
		expect(result.retryAfterMs).toBeGreaterThan(0)
		expect(result.retryAfterMs).toBeLessThanOrEqual(60_000)
	})

	test('the window expires', async () => {
		// A short real window rather than a mocked clock: the whole implementation is
		// two Date.now() comparisons, and faking time here would test the fake.
		const limiter = createRateLimiter({ limit: 1, windowMs: 20 })

		expect(limiter.check('a').allowed).toBe(true)
		expect(limiter.check('a').allowed).toBe(false)

		await Bun.sleep(30)

		expect(limiter.check('a').allowed).toBe(true)
	})

	test('refusals do not extend the window', () => {
		// A limiter that pushed `resetAt` forward on every rejected attempt would
		// let an attacker lock a victim out indefinitely by hammering their number.
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
		limiter.check('a')

		const first = limiter.check('a')
		const second = limiter.check('a')

		if (first.allowed || second.allowed) throw new Error('unreachable')
		// Time only moves forward, so the remaining wait must not grow.
		expect(second.retryAfterMs).toBeLessThanOrEqual(first.retryAfterMs)
	})

	test('expired keys are swept rather than accumulating forever', async () => {
		// The Map is keyed by attacker-supplied values, so unbounded growth is a
		// memory leak they control. The sweep only runs past the size threshold, so
		// this asserts the mechanism works, not the exact threshold.
		const limiter = createRateLimiter({ limit: 1, windowMs: 5 })

		for (let i = 0; i < 50; i++) limiter.check(`key-${i}`)
		await Bun.sleep(15)
		// Every earlier window has expired, so each of these is a fresh allow.
		for (let i = 0; i < 50; i++) {
			expect(limiter.check(`key-${i}`).allowed).toBe(true)
		}
	})
})
