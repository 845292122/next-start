import { describe, expect, test } from 'bun:test'

// Order matters: core/db/client.ts opens the database at module scope, so a
// static `import` would be hoisted above this line and the suite would run
// against the dev database. Everything below is a dynamic import for that
// reason.
process.env.DATABASE_URL = ':memory:'

const { runMigrations } = await import('@/core/db/migrate')
const { findOrCreateUserByPhone } = await import('@/core/auth/otp')

await runMigrations()

describe('findOrCreateUserByPhone', () => {
	test('creates a user the first time a number is seen', async () => {
		const user = await findOrCreateUserByPhone('13900000001')
		expect(user?.id).toBeTruthy()
		expect(user?.phone).toBe('13900000001')
		// Login-is-signup, so there's no name until the user sets one.
		expect(user?.name).toBeNull()
	})

	test('returns the same row on subsequent logins', async () => {
		const first = await findOrCreateUserByPhone('13900000002')
		const second = await findOrCreateUserByPhone('13900000002')
		expect(second.id).toBe(first.id)
	})

	// Guards the onConflictDoNothing upsert. The obvious select-then-insert
	// version fails here: every caller sees "no such user", they all insert, and
	// all but one die on the `phone` unique index — measured at 7 failures out of
	// 8 before the fix.
	test('concurrent first-time logins for one number all succeed', async () => {
		const results = await Promise.all(
			Array.from({ length: 8 }, () => findOrCreateUserByPhone('13900000003')),
		)

		const ids = new Set(results.map((u) => u.id))
		expect(ids.size).toBe(1)
	})
})
