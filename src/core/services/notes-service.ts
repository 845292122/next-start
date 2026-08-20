import { and, desc, eq, like, sql } from 'drizzle-orm'
import { db } from '@/core/db/client'
import { notesTable } from '@/core/db/schema'

/**
 * Every function here takes `userId` first and puts it in the `where` of every
 * statement. That's the guard that makes a route handler forgetting its own
 * session check harmless — it can't reach another user's rows.
 */

export async function listNotes(userId: string, query?: string) {
	return db
		.select()
		.from(notesTable)
		.where(
			and(
				eq(notesTable.userId, userId),
				// SQLite has no `ilike`. Its bare LIKE folds case for ASCII only and
				// that behaviour also depends on the column collation, so matching is
				// done on lower() explicitly rather than left to the default.
				query
					? like(sql`lower(${notesTable.title})`, `%${query.toLowerCase()}%`)
					: undefined,
			),
		)
		.orderBy(desc(notesTable.createdAt))
}

export async function createNote(
	userId: string,
	input: { title: string; body: string },
) {
	// `await` is what runs the statement: without it .returning() hands back a
	// query builder, and destructuring that throws "not iterable".
	const [note] = await db
		.insert(notesTable)
		.values({ userId, title: input.title, body: input.body })
		.returning()
	return note
}

export async function toggleNoteDone(userId: string, noteId: string) {
	const [existing] = await db
		.select()
		.from(notesTable)
		.where(and(eq(notesTable.id, noteId), eq(notesTable.userId, userId)))
	if (!existing) throw new Error('note not found')

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
