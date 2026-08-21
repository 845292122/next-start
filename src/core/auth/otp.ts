import { eq } from 'drizzle-orm'
import { db } from '@/core/db/client'
import { usersTable } from '@/core/db/schema'

/**
 * No real SMS provider is wired here. `authorize()` in config.ts compares the
 * submitted code against DEMO_VERIFICATION_CODE (core/auth/schema.ts)
 * directly — there's no per-phone code generation, storage, or expiry.
 *
 * This is the same "honest stub" shape as core/mailer/send.ts (logs and skips
 * when RESEND_API_KEY is unset) and core/storage/local-stub.ts (writes to
 * local disk): a working placeholder, not a real integration. To wire a real
 * SMS provider, replace this whole file with one that generates a random
 * code, stores it (a new table keyed by phone, with an expiry), and actually
 * sends it — then have LoginForm's "send code" button call a Server Action
 * instead of just starting a client-side countdown.
 */

/**
 * Phone-otp login doubles as signup: a phone that hasn't been seen before gets
 * a row on its first successful verification, with no separate registration
 * step. `name` stays null until the user sets one.
 *
 * Insert-first rather than the obvious select-then-insert: two concurrent
 * first-time logins with the same number both see "no such user" and both
 * insert, and the second one dies on the `phone` unique index. Letting the
 * database arbitrate with `onConflictDoNothing` makes that path a no-op
 * instead, and the select below then finds whichever row won.
 */
export async function findOrCreateUserByPhone(phone: string) {
	const [created] = await db
		.insert(usersTable)
		.values({ phone })
		.onConflictDoNothing({ target: usersTable.phone })
		.returning()
	if (created) return created

	// Conflict — the row already existed (or a racing request just made it).
	const [existing] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.phone, phone))
	return existing
}
