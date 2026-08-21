import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/core/db/client'
import { notesTable } from '@/core/db/schema'
import { ConflictError, NotFoundError } from '@/core/errors'

/**
 * Every function here takes `userId` first and puts it in the `where` of every
 * statement. That's the guard that makes a route handler forgetting its own
 * session check harmless — it can't reach another user's rows.
 */

/** Rows per page when a caller doesn't say. */
export const NOTES_PAGE_SIZE = 20

/**
 * Hard ceiling on rows one call can return, whatever the caller asks for.
 *
 * A `limit` that comes from the network is attacker-controlled, so it needs a
 * ceiling here rather than only in the zod schema — the schema protects the
 * exposure layer, this protects the service from every caller including future
 * server-side ones.
 */
const NOTES_MAX_PAGE_SIZE = 100

/** Notes one user may hold. Arbitrary; the quota check it enables is the point. */
export const NOTES_PER_USER_LIMIT = 500

/**
 * Escapes the wildcards in a user-supplied `LIKE` pattern.
 *
 * `%` and `_` are wildcards, so an unescaped search for `%` matches every row and
 * `_` matches any single character. Not an injection — drizzle parameterises the
 * value — but it does mean the search box silently doesn't do what the user asked.
 *
 * The backslash has to be escaped first, or escaping the others would double-escape
 * it. It's declared as the escape character by the `ESCAPE` clause in the query
 * below; SQLite has no default one.
 */
function escapeLikePattern(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')
}

/**
 * One page of a user's notes, newest first, plus the total so a caller can tell
 * whether more exist.
 *
 * **Always bounded.** An unpaginated `select *` is fine with the two seeded rows
 * and a production incident with a hundred thousand; since this service is the
 * template other domains get copied from, the bound belongs here rather than in
 * each caller.
 */
export async function listNotes(
	userId: string,
	options: { query?: string; limit?: number; offset?: number } = {},
) {
	const limit = Math.min(
		Math.max(options.limit ?? NOTES_PAGE_SIZE, 1),
		NOTES_MAX_PAGE_SIZE,
	)
	const offset = Math.max(options.offset ?? 0, 0)

	const where = and(
		eq(notesTable.userId, userId),
		// SQLite has no `ilike`. Its bare LIKE folds case for ASCII only and that
		// behaviour also depends on the column collation, so matching is done on
		// lower() explicitly rather than left to the default.
		//
		// Note what `lower()` costs: it makes the expression unindexable, so this
		// search is a scan of the user's rows. Fine at this size — the composite
		// index still narrows to one user — but a domain with big per-user volumes
		// wants SQLite's FTS5 instead of LIKE.
		options.query
			? // Written as raw `sql` rather than drizzle's `like()` because that helper
				// takes only (column, pattern) and there's no way to attach the `ESCAPE`
				// clause — which SQLite requires, since it defines no escape character
				// by default. The pattern is still a bound parameter.
				sql`lower(${notesTable.title}) like ${`%${escapeLikePattern(options.query.toLowerCase())}%`} escape '\\'`
			: undefined,
	)

	// Two queries rather than a window function: SQLite supports `count(*) over ()`
	// but it would be computed per row, and the count is wanted once.
	const [items, [totals]] = await Promise.all([
		db
			.select()
			.from(notesTable)
			.where(where)
			.orderBy(desc(notesTable.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(notesTable).where(where),
	])

	return { items, total: totals?.total ?? 0, limit, offset }
}

/**
 * The template's transaction example.
 *
 * The quota check is why it needs one: counting and then inserting is two
 * statements, and without a transaction two concurrent requests can both read
 * `499` and both insert. That read-then-write shape is what a transaction is
 * actually for, and it's the shape most real invariants have (stock levels,
 * balances, seat reservations).
 *
 * Throwing inside the callback rolls back — drizzle issues the `ROLLBACK` — so the
 * quota rejection can't leave a partial write behind.
 *
 * > SQLite specifics worth knowing before copying this: writes serialize on a
 * > single writer, so a transaction holding the write lock blocks other writers
 * > rather than deadlocking with them. Keep transactions short and never `await`
 * > anything unrelated (an HTTP call, say) inside one.
 */
export async function createNote(
	userId: string,
	input: { title: string; body: string },
) {
	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ total: count() })
			.from(notesTable)
			.where(eq(notesTable.userId, userId))

		if ((existing?.total ?? 0) >= NOTES_PER_USER_LIMIT) {
			throw new ConflictError('note quota reached', { fields: ['title'] })
		}

		// `await` is what runs the statement: without it .returning() hands back a
		// query builder, and destructuring that throws "not iterable".
		const [note] = await tx
			.insert(notesTable)
			.values({ userId, title: input.title, body: input.body })
			.returning()
		return note
	})
}

export async function toggleNoteDone(userId: string, noteId: string) {
	const [existing] = await db
		.select()
		.from(notesTable)
		.where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))
	// NotFoundError, not ForbiddenError, when the row belongs to someone else:
	// distinguishing the two would tell a caller which ids exist. The `userId` in
	// the where clause above is what collapses both cases to this one throw.
	if (!existing) throw new NotFoundError('note not found')

	const [note] = await db
		.update(notesTable)
		.set({ done: !existing.done })
		.where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))
		.returning()
	return note
}

export async function deleteNote(userId: string, noteId: string) {
	await db
		.delete(notesTable)
		.where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))
}
