import { z } from 'zod'

export const createNoteSchema = z.object({
	title: z.string().min(1).max(200),
	body: z.string().max(5000).default(''),
})

/** After parsing — `body` is always present. What the service receives. */
export type CreateNoteInput = z.output<typeof createNoteSchema>
/** Before parsing — `body` may be omitted. What a form holds. */
export type CreateNoteValues = z.input<typeof createNoteSchema>

/**
 * The `[id]` segment of `/api/notes/[id]`.
 *
 * Route params are arbitrary strings — whatever the caller put in the URL. Ids
 * are `crypto.randomUUID()` (see `core/db/schema.ts`), so anything that isn't a
 * uuid can be rejected as a 400 before it reaches the database instead of coming
 * back as an empty result that then has to be guessed at.
 */
export const noteParamsSchema = z.object({
	id: z.uuid(),
})
