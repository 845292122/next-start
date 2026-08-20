'use server'

import { revalidatePath } from 'next/cache'
import { getRequiredSession } from '@/core/auth/session'
import { createNote } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema } from '@/features/notes/schema'

export async function createNoteAction(input: {
	title: string
	body?: string
}) {
	const session = await getRequiredSession()
	const parsed = createNoteSchema.parse(input)

	const note = await createNote(session.user.id, parsed)

	// Routes live under app/[locale]/, so the path has to be the route pattern
	// plus the 'page' type rather than a concrete URL — otherwise only the
	// literal '/notes' (which no route matches) gets invalidated.
	revalidatePath('/[locale]/notes', 'page')

	// Returned so the caller can drop it straight into the SWR cache instead of
	// waiting for a refetch.
	return toNoteDTO(note)
}
