import { getRequiredBearerSession } from '@/core/auth/session'
import { readJson, withHandler } from '@/core/http'
import { createNote, listNotes } from '@/core/services/notes-service'
import { parseOrThrow } from '@/core/validation'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema, listNotesQuerySchema } from '@/features/notes/schema'

/**
 * `/api/v1/notes` — the mini program's notes API.
 *
 * ## Why this exists next to /api/notes rather than replacing it
 *
 * The two are different *surfaces*, deliberately, and the difference is the
 * transport:
 *
 * | | transport | consumer | CSRF |
 * | --- | --- | --- | --- |
 * | `/api/notes` | cookie | the worked example of a cookie-based handler | relies on `SameSite=Lax` + preflight |
 * | `/api/v1/notes` | **Bearer only** | WeChat mini program, native apps | **none, by construction** |
 *
 * `getRequiredBearerSession` reads the `Authorization` header and *nothing else*, so
 * a browser's automatically-attached cookie authenticates nothing here. That's what
 * makes this surface CSRF-free without a token — see `core/auth/verify.ts` on why
 * accepting both would undo it, and `e2e/api-v1.e2e.ts` for the assertion.
 *
 * ## The versioned prefix
 *
 * `/api/v1` from the first endpoint, not retrofitted. A mini program rolls out
 * gradually and old versions keep calling the old shape for a while, so you need
 * somewhere to put v2 without breaking them. It costs one path segment now and is
 * painful to add later.
 *
 * Everything data-related still goes through `core/services/` — the service is what
 * scopes rows to `userId`, so this route cannot reach another user's notes even if
 * it forgot to check anything (DEVELOPMENT.md § 分层与依赖方向, rule 4).
 */

export const GET = withHandler(async (request) => {
	const session = await getRequiredBearerSession(request)

	const params = new URL(request.url).searchParams
	const { query, limit, offset } = parseOrThrow(listNotesQuerySchema, {
		query: params.get('q') ?? undefined,
		limit: params.get('limit') ?? undefined,
		offset: params.get('offset') ?? undefined,
	})

	const page = await listNotes(session.user.id, { query, limit, offset })

	// Same envelope as /api/notes: an external consumer needs `total` to know whether
	// to ask for another page.
	return Response.json({
		items: page.items.map(toNoteDTO),
		total: page.total,
	})
})

export const POST = withHandler(async (request) => {
	const session = await getRequiredBearerSession(request)
	const body = await readJson(request, createNoteSchema)

	const note = await createNote(session.user.id, body)

	return Response.json(toNoteDTO(note), { status: 201 })
})
