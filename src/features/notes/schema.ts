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
})
