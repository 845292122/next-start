import { z } from 'zod'
import '@/core/zod-config'

export const createNoteSchema = z.object({
	title: z.string().min(1).max(200),
	body: z.string().max(5000).default(''),
})

/** After parsing — `body` is always present. What the service receives. */
export type CreateNoteInput = z.output<typeof createNoteSchema>
/** Before parsing — `body` may be omitted. What a form holds. */
export type CreateNoteValues = z.input<typeof createNoteSchema>

/**
 * A note id on its own.
 *
 * Shared by the toggle/delete Server Actions and by the `[id]` segment of
 * `/api/notes/[id]` — one schema so the two paths can't drift. Ids are
 * `crypto.randomUUID()` (see `core/db/schema.ts`), so anything that isn't a uuid
 * is rejected before it reaches the database rather than coming back as an empty
 * result that then has to be guessed at. Route params in particular are arbitrary
 * strings: whatever the caller typed into the URL.
 */
export const noteIdSchema = z.object({
	id: z.uuid(),
})

/**
 * Input for the list action. `query` is the search box's value.
 *
 * Bounded rather than a bare `string`: it reaches a `LIKE` pattern, and an
 * unbounded one is a free way to make the database do work.
 */
export const listNotesSchema = z.object({
	query: z.string().max(200).optional(),
	/**
	 * How many rows to return. Bounded here *and* in the service — this stops a
	 * nonsense value at the edge, and `notes-service.ts` re-clamps because it must
	 * be safe for every caller, not just this one.
	 */
	limit: z.number().int().positive().max(100).optional(),
	offset: z.number().int().nonnegative().optional(),
})

/**
 * `listNotesSchema` for a Route Handler, where every value arrives as a string.
 *
 * A separate schema rather than `z.coerce` on the shared one: the Server Action
 * receives real numbers from typed client code, and coercing there would quietly
 * accept `"20"` and `true` as valid input. The coercion belongs only at the
 * boundary that actually has strings.
 */
export const listNotesQuerySchema = listNotesSchema.extend({
	limit: z.coerce.number().int().positive().max(100).optional(),
	offset: z.coerce.number().int().nonnegative().optional(),
})
