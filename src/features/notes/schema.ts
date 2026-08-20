import { z } from 'zod'

export const createNoteSchema = z.object({
	title: z.string().min(1).max(200),
	body: z.string().max(5000).default(''),
})

/** After parsing — `body` is always present. What the service receives. */
export type CreateNoteInput = z.output<typeof createNoteSchema>
/** Before parsing — `body` may be omitted. What a form holds. */
export type CreateNoteValues = z.input<typeof createNoteSchema>
