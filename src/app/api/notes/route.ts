import { getRequiredSession } from '@/core/auth/session'
import { readJson, withHandler } from '@/core/http'
import { createNote, listNotes } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema } from '@/features/notes/schema'

/**
 * The worked example of the **external-consumer** path: third-party callers,
 * mobile clients, webhooks (see AGENTS.md). Nothing inside this app calls these —
 * `NoteList` reads and mutates through the Server Actions in
 * `features/notes/actions.ts`, because needing to fetch from the client was never
 * a reason to add a Route Handler.
 *
 * They're kept, and covered by `e2e/api-errors.e2e.ts`, because "how do I expose
 * something to a caller outside this app" is a real question a template should
 * answer.
 *
 * Route handlers don't run layouts, so the (app) group's auth guard doesn't apply
 * here — each handler establishes its own session.
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
