/**
 * A fixed-window rate limiter, in process memory.
 *
 * ## Read this before shipping
 *
 * **The state is per process.** Two app instances behind a load balancer each
 * allow the full quota, so the effective limit is `limit × instances`; on a
 * serverless platform, where an instance can be created per request, it degrades
 * to no limit at all. It is a real defence for the single-instance deployment this
 * template is shaped for (one process, SQLite in a file — see the note on
 * concurrency in DEVELOPMENT.md), and a **placeholder** for anything larger.
 *
 * This is the same "honest stub" shape as `core/auth/otp.ts` and
 * `core/storage/local-stub.ts`: something that works, with its boundary written
 * down. To go multi-instance, keep the `RateLimiter` interface and back it with
 * Redis or Upstash — every call site below is already written against the
 * interface, not against the Map.
 *
 * Fixed window rather than a sliding window or token bucket: a caller can burst
 * up to `limit` at a window boundary and get `limit` again immediately after, so
 * the true worst case is `2 × limit` over one window. For "stop someone brute
 * forcing a 6-digit code" that's irrelevant, and the implementation is small
 * enough to be obviously correct.
 */

export type RateLimitResult =
	| { allowed: true; remaining: number }
	| { allowed: false; retryAfterMs: number }

export interface RateLimiter {
	/** Counts one attempt against `key` and says whether it's allowed. */
	check(key: string): RateLimitResult
}

/**
 * Above this many tracked keys, expired entries are swept before inserting a new
 * one. Without a sweep the Map grows with every distinct key ever seen, which for
 * a phone-keyed limiter is an attacker-controlled memory leak.
 */
const SWEEP_THRESHOLD = 10_000

export function createRateLimiter({
	limit,
	windowMs,
}: {
	limit: number
	windowMs: number
}): RateLimiter {
	const windows = new Map<string, { count: number; resetAt: number }>()

	return {
		check(key) {
			const now = Date.now()
			const existing = windows.get(key)

			if (!existing || existing.resetAt <= now) {
				if (windows.size >= SWEEP_THRESHOLD) {
					for (const [k, v] of windows) {
						if (v.resetAt <= now) windows.delete(k)
					}
				}
				windows.set(key, { count: 1, resetAt: now + windowMs })
				return { allowed: true, remaining: limit - 1 }
			}

			if (existing.count >= limit) {
				return { allowed: false, retryAfterMs: existing.resetAt - now }
			}

			existing.count += 1
			return { allowed: true, remaining: limit - existing.count }
		},
	}
}

/**
 * Next re-evaluates modules on every dev HMR pass and in each parallel build
 * worker. Without this cache the limiter's Map would be replaced on every
 * evaluation, which silently resets everyone's counters — the same reason
 * `core/db/client.ts` caches its connection.
 */
const globalForRateLimit = globalThis as unknown as {
	signInLimiter?: RateLimiter
}

/**
 * Guards the sign-in attempt itself, keyed by phone number.
 *
 * 5 attempts per 10 minutes: enough for a real user fat-fingering a code, far too
 * few to walk a 6-digit space (a million codes would take ~3.8 years at this
 * rate).
 *
 * Keyed by phone rather than by IP deliberately. The threat is "guess the code
 * for *this* number", and an attacker rotating IPs is easy while rotating the
 * target number defeats the purpose. IP-keying also misreads every user behind
 * one NAT as a single client. A production setup wants both, with the IP taken
 * from a header your own reverse proxy sets (never from a client-supplied
 * `X-Forwarded-For`, which is trivially spoofed).
 */
globalForRateLimit.signInLimiter ??= createRateLimiter({
	limit: 5,
	windowMs: 10 * 60 * 1000,
})

export const signInLimiter = globalForRateLimit.signInLimiter
