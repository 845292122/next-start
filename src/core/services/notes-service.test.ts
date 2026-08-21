import { beforeAll, describe, expect, test } from 'bun:test'

// `:memory:` is set for the whole unit run by test/unit-setup.ts (--preload),
// which is the only place it can be set reliably — see the comment there. This
// line is belt-and-braces so that running *this file alone* without the preload
// still can't touch the dev database.
//
// Dynamic imports below, not static ones: a static import is hoisted above this
// line, so on the run-this-file-alone path the fallback would come too late.
process.env.DATABASE_URL = ':memory:'

const { db } = await import('@/core/db/client')
const { runMigrations } = await import('@/core/db/migrate')
const { usersTable } = await import('@/core/db/schema')
const { createNote, deleteNote, listNotes, toggleNoteDone } = await import(
	'@/core/services/notes-service'
)

// An in-memory database costs nothing to build and is thrown away with the
// process, so there's no CREATE/DROP DATABASE dance and no teardown.
await runMigrations()

let userId: string

beforeAll(async () => {
	const [user] = await db
		.insert(usersTable)
		.values({ name: 'Test User', email: 'notes-service-test@example.com' })
		.returning()
	userId = user.id
})

/** A user of their own, so a test's rows can't be seen by another's assertions. */
async function freshUser(label: string) {
	const [user] = await db
		.insert(usersTable)
		.values({ email: `notes-${label}-${crypto.randomUUID()}@example.com` })
		.returning()
	return user.id
}

describe('notes-service', () => {
	test('createNote + listNotes', async () => {
		const note = await createNote(userId, { title: 'Hello', body: 'World' })
		expect(note.title).toBe('Hello')
		expect(note.done).toBe(false)

		const { items } = await listNotes(userId)
		expect(items.some((n) => n.id === note.id)).toBe(true)
	})

	test('listNotes filters by query', async () => {
		const owner = await freshUser('filter')
		await createNote(owner, { title: 'Findable note', body: '' })
		await createNote(owner, { title: 'Unrelated', body: '' })

		const { items, total } = await listNotes(owner, { query: 'Findable' })
		expect(items.every((n) => n.title.includes('Findable'))).toBe(true)
		// The total counts every match, not just the returned page.
		expect(total).toBe(1)
	})

	// Guards listNotes' lower() wrapper: SQLite's LIKE is only case-insensitive
	// for ASCII and only under the default collation, so dropping it would make
	// title search case-sensitive without any error.
	test('listNotes matches regardless of case', async () => {
		const owner = await freshUser('case')
		await createNote(owner, { title: 'Casing Matters', body: '' })

		const { items } = await listNotes(owner, { query: 'casing matters' })
		expect(items.some((n) => n.title === 'Casing Matters')).toBe(true)
	})

	test('toggleNoteDone flips the done state', async () => {
		const note = await createNote(userId, { title: 'Toggle me', body: '' })
		expect(note.done).toBe(false)

		const toggled = await toggleNoteDone(userId, note.id)
		expect(toggled.done).toBe(true)

		const toggledAgain = await toggleNoteDone(userId, note.id)
		expect(toggledAgain.done).toBe(false)
	})

	test('deleteNote removes the note', async () => {
		const note = await createNote(userId, { title: 'Delete me', body: '' })
		await deleteNote(userId, note.id)

		const { items } = await listNotes(userId)
		expect(items.some((n) => n.id === note.id)).toBe(false)
	})

	// The userId in every where clause is the authorization boundary, not a
	// convenience — a wrong id must not reach the row.
	test('another user cannot read, toggle or delete the note', async () => {
		const note = await createNote(userId, { title: 'Private', body: '' })

		expect((await listNotes('someone-else')).items).toHaveLength(0)
		expect(toggleNoteDone('someone-else', note.id)).rejects.toThrow(
			'note not found',
		)

		await deleteNote('someone-else', note.id)
		const { items } = await listNotes(userId)
		expect(items.some((n) => n.id === note.id)).toBe(true)
	})
})

describe('listNotes pagination', () => {
	test('never returns more than the limit', async () => {
		const owner = await freshUser('page')
		for (let i = 0; i < 5; i++) {
			await createNote(owner, { title: `Note ${i}`, body: '' })
		}

		const page = await listNotes(owner, { limit: 2 })

		expect(page.items).toHaveLength(2)
		// The count is of everything matching, which is what tells a caller there's
		// more to fetch.
		expect(page.total).toBe(5)
	})

	test('offset walks through the pages without repeating', async () => {
		const owner = await freshUser('offset')
		for (let i = 0; i < 5; i++) {
			await createNote(owner, { title: `Paged ${i}`, body: '' })
		}

		const first = await listNotes(owner, { limit: 2, offset: 0 })
		const second = await listNotes(owner, { limit: 2, offset: 2 })
		const third = await listNotes(owner, { limit: 2, offset: 4 })

		const ids = [...first.items, ...second.items, ...third.items].map(
			(n) => n.id,
		)
		expect(ids).toHaveLength(5)
		expect(new Set(ids).size).toBe(5)
	})

	test('clamps a hostile limit instead of trusting it', async () => {
		// The limit reaches the service from the network. A caller asking for a
		// million rows must not get them, whatever the zod schema at the edge did.
		const owner = await freshUser('clamp')
		await createNote(owner, { title: 'One', body: '' })

		expect((await listNotes(owner, { limit: 1_000_000 })).limit).toBe(100)
		expect((await listNotes(owner, { limit: 0 })).limit).toBe(1)
		expect((await listNotes(owner, { limit: -5 })).limit).toBe(1)
		expect((await listNotes(owner, { offset: -5 })).offset).toBe(0)
	})

	test('is bounded even when no limit is given', async () => {
		// The regression that matters: this service is what other domains get copied
		// from, so an unbounded default would propagate.
		const owner = await freshUser('default')
		await createNote(owner, { title: 'Only', body: '' })

		expect((await listNotes(owner)).limit).toBe(20)
	})
})

describe('listNotes LIKE escaping', () => {
	test('a bare % is treated as text, not as "match everything"', async () => {
		const owner = await freshUser('like-percent')
		await createNote(owner, { title: '100% done', body: '' })
		await createNote(owner, { title: 'nothing special', body: '' })

		const { items, total } = await listNotes(owner, { query: '%' })

		// Unescaped, `%` is a LIKE wildcard and this would return both rows — the
		// search box would silently ignore what the user typed.
		expect(total).toBe(1)
		expect(items[0]?.title).toBe('100% done')
	})

	test('a bare _ is treated as text, not as "any character"', async () => {
		const owner = await freshUser('like-underscore')
		await createNote(owner, { title: 'snake_case', body: '' })
		await createNote(owner, { title: 'snakeXcase', body: '' })

		const { items } = await listNotes(owner, { query: 'snake_case' })

		expect(items).toHaveLength(1)
		expect(items[0]?.title).toBe('snake_case')
	})

	test('a literal backslash still matches', async () => {
		// The escape character itself has to be escaped first, or escaping the
		// wildcards would double-escape it.
		const owner = await freshUser('like-backslash')
		await createNote(owner, { title: 'path\\to\\thing', body: '' })

		const { items } = await listNotes(owner, { query: '\\to\\' })
		expect(items).toHaveLength(1)
	})
})

describe('createNote transaction', () => {
	test('commits the insert', async () => {
		const owner = await freshUser('tx-commit')

		const note = await createNote(owner, { title: 'Committed', body: '' })

		// Read back through a fresh query, not the returned row: that's what proves
		// the transaction committed rather than just returned.
		const { items } = await listNotes(owner)
		expect(items.map((n) => n.id)).toContain(note.id)
	})

	test('rolls back when the quota is exceeded', async () => {
		// Exercises the reason the transaction exists: the count and the insert are
		// two statements, and the check is only meaningful if they're atomic.
		//
		// The quota is checked against rows the *test* inserts directly, so this
		// doesn't need 500 createNote calls.
		const { notesTable } = await import('@/core/db/schema')
		const { NOTES_PER_USER_LIMIT } = await import(
			'@/core/services/notes-service'
		)
		const owner = await freshUser('tx-quota')

		await db.insert(notesTable).values(
			Array.from({ length: NOTES_PER_USER_LIMIT }, (_, i) => ({
				userId: owner,
				title: `Bulk ${i}`,
			})),
		)

		expect(
			createNote(owner, { title: 'One too many', body: '' }),
		).rejects.toMatchObject({ code: 'CONFLICT', fields: ['title'] })

		// Nothing partial left behind.
		const { total } = await listNotes(owner)
		expect(total).toBe(NOTES_PER_USER_LIMIT)
	})

	test('a rollback leaves the schema usable', async () => {
		// Not a tautology — it is exactly what fails against a bare `:memory:` URL.
		// @libsql/client opens a second connection for a transaction, and a private
		// in-memory database is invisible to it, which leaves the original connection
		// broken with `no such table` afterwards. `core/db/client.ts` maps `:memory:`
		// to the shared-cache URI for this reason; this test is what would catch a
		// regression there.
		const owner = await freshUser('tx-schema')
		await createNote(owner, { title: 'Still works', body: '' })

		expect((await listNotes(owner)).total).toBe(1)
	})
})

describe('updatedAt', () => {
	test('is set on insert', async () => {
		const note = await createNote(userId, { title: 'Timestamped', body: '' })
		expect(note.updatedAt).toBeInstanceOf(Date)
		expect(note.updatedAt.getTime()).toBeGreaterThan(0)
	})

	test('moves when the row is updated through drizzle', async () => {
		// `$onUpdate` is a drizzle-side default, so it only fires for updates that go
		// through drizzle — raw SQL bypasses it.
		const note = await createNote(userId, { title: 'Will change', body: '' })
		await Bun.sleep(1100) // createdAt/updatedAt are unix *seconds*.

		const toggled = await toggleNoteDone(userId, note.id)

		expect(toggled.updatedAt.getTime()).toBeGreaterThan(
			note.updatedAt.getTime(),
		)
		// createdAt must not move.
		expect(toggled.createdAt.getTime()).toBe(note.createdAt.getTime())
	})
})
