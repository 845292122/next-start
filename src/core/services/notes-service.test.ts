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

describe('notes-service', () => {
	test('createNote + listNotes', async () => {
		const note = await createNote(userId, { title: 'Hello', body: 'World' })
		expect(note.title).toBe('Hello')
		expect(note.done).toBe(false)

		const notes = await listNotes(userId)
		expect(notes.some((n) => n.id === note.id)).toBe(true)
	})

	test('listNotes filters by query', async () => {
		await createNote(userId, { title: 'Findable note', body: '' })
		await createNote(userId, { title: 'Unrelated', body: '' })

		const notes = await listNotes(userId, 'Findable')
		expect(notes.every((n) => n.title.includes('Findable'))).toBe(true)
	})

	// Guards listNotes' lower() wrapper: SQLite's LIKE is only case-insensitive
	// for ASCII and only under the default collation, so dropping it would make
	// title search case-sensitive without any error.
	test('listNotes matches regardless of case', async () => {
		await createNote(userId, { title: 'Casing Matters', body: '' })

		const notes = await listNotes(userId, 'casing matters')
		expect(notes.some((n) => n.title === 'Casing Matters')).toBe(true)
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

		const notes = await listNotes(userId)
		expect(notes.some((n) => n.id === note.id)).toBe(false)
	})

	// The userId in every where clause is the authorization boundary, not a
	// convenience — a wrong id must not reach the row.
	test('another user cannot read, toggle or delete the note', async () => {
		const note = await createNote(userId, { title: 'Private', body: '' })

		expect(await listNotes('someone-else')).toHaveLength(0)
		expect(toggleNoteDone('someone-else', note.id)).rejects.toThrow(
			'note not found',
		)

		await deleteNote('someone-else', note.id)
		const notes = await listNotes(userId)
		expect(notes.some((n) => n.id === note.id)).toBe(true)
	})
})
