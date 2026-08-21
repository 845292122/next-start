import { getRequiredSession } from '@/core/auth/session'
import { readParams, withHandler } from '@/core/http'
import { deleteNote, toggleNoteDone } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'
import { noteParamsSchema } from '@/features/notes/schema'

/**
 * See ../route.ts on why there's no explicit 401 or 400 handling here.
 *
 * `toggleNoteDone` throws `NotFoundError` for an id that doesn't exist *or*
 * belongs to another user, and `withHandler` maps that to a 404 — it used to
 * escape as a 500.
 */

// RouteContext is a Next-generated global keyed by route path, so `params` is
// typed from the route itself — see core/http.ts's withHandler.
type NoteRouteContext = RouteContext<'/api/notes/[id]'>

export const PATCH = withHandler<NoteRouteContext>(
	async (_request, { params }) => {
		const session = await getRequiredSession()
		const { id } = await readParams(params, noteParamsSchema)

		const note = await toggleNoteDone(session.user.id, id)

		return Response.json(toNoteDTO(note))
	},
)

export const DELETE = withHandler<NoteRouteContext>(
	async (_request, { params }) => {
		const session = await getRequiredSession()
		const { id } = await readParams(params, noteParamsSchema)

		await deleteNote(session.user.id, id)

		return new Response(null, { status: 204 })
	},
)
