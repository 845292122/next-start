import { getRequiredSession } from '@/core/auth/session'
import { readJson, withHandler } from '@/core/http'
import { createNote, listNotes } from '@/core/services/notes-service'
import { parseOrThrow } from '@/core/validation'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema, listNotesQuerySchema } from '@/features/notes/schema'

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

	// Query params are strings; the schema is what turns `?limit=abc` into a 400
	// rather than a NaN that reaches the service.
	const params = new URL(request.url).searchParams
	const { query, limit, offset } = parseOrThrow(listNotesQuerySchema, {
		query: params.get('q') ?? undefined,
		limit: params.get('limit') ?? undefined,
		offset: params.get('offset') ?? undefined,
	})

	const page = await listNotes(session.user.id, { query, limit, offset })

	// The envelope, not a bare array: an external consumer needs the total to know
	// whether to ask for another page, and adding it later would be a breaking
	// change to a published response shape.
	return Response.json({
		items: page.items.map(toNoteDTO),
		total: page.total,
	})
})

export const POST = withHandler(async (request) => {
	const session = await getRequiredSession()
	const body = await readJson(request, createNoteSchema)

	const note = await createNote(session.user.id, body)

	return Response.json(toNoteDTO(note), { status: 201 })
})
