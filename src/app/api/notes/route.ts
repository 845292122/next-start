import { getRequiredSession } from '@/core/auth/session'
import { readJson, withHandler } from '@/core/http'
import { createNote, listNotes } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema } from '@/features/notes/schema'

/**
 * Route handlers don't run layouts, so the (app) group's auth guard doesn't
 * apply here — each handler establishes its own session.
 *
 * `getRequiredSession()` throws `UnauthorizedError` and `withHandler` turns that
 * into a 401, which is why there's no `if (!session) return 401` in sight. Same
 * for the schema parse: `readJson` raises `ValidationError` and comes back as a
 * 400, where a bare `schema.parse()` used to escape as a 500.
 */

export const GET = withHandler(async (request) => {
	const session = await getRequiredSession()

	const query = new URL(request.url).searchParams.get('q') ?? undefined
	const notes = await listNotes(session.user.id, query)

	return Response.json(notes.map(toNoteDTO))
})

export const POST = withHandler(async (request) => {
	const session = await getRequiredSession()
	const body = await readJson(request, createNoteSchema)

	const note = await createNote(session.user.id, body)

	return Response.json(toNoteDTO(note), { status: 201 })
})
