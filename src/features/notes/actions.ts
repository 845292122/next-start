'use server'

import { revalidatePath } from 'next/cache'
import { runAction } from '@/core/action'
import type { ActionResult } from '@/core/action-result'
import { createNote } from '@/core/services/notes-service'
import type { NoteDTO } from '@/features/notes/dto'
import { toNoteDTO } from '@/features/notes/dto'
import {
	type CreateNoteValues,
	createNoteSchema,
} from '@/features/notes/schema'

/**
 * The reference shape for a Server Action in this project: a plain exported
 * async function whose body is one `runAction` call.
 *
 * `runAction` owns the session check, the schema parse, the error → code mapping
 * and the logging — see `core/action.ts`. The handler below is only the part
 * that's actually specific to creating a note.
 *
 * It has to be `export async function` rather than
 * `export const createNoteAction = someWrapper(...)`: a `'use server'` module
 * may only export async functions.
 */
export async function createNoteAction(
	input: CreateNoteValues,
): Promise<ActionResult<NoteDTO>> {
	return runAction({
		name: 'createNote',
		schema: createNoteSchema,
		input,
		handler: async (parsed, session) => {
			const note = await createNote(session.user.id, parsed)

			// Routes live under app/[locale]/, so the path has to be the route
			// pattern plus the 'page' type rather than a concrete URL — otherwise
			// only the literal '/notes' (which no route matches) gets invalidated.
			revalidatePath('/[locale]/notes', 'page')

			return toNoteDTO(note)
		},
	})
}
