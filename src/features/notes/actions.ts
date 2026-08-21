'use server'

import { revalidatePath } from 'next/cache'
import { runAction } from '@/core/action'
import type { ActionResult } from '@/core/action-result'
import {
	createNote,
	deleteNote,
	listNotes,
	toggleNoteDone,
} from '@/core/services/notes-service'
import type { NoteDTO, NotePage } from '@/features/notes/dto'
import { toNoteDTO } from '@/features/notes/dto'
import {
	type CreateNoteValues,
	createNoteSchema,
	listNotesSchema,
	noteIdSchema,
} from '@/features/notes/schema'

/**
 * Every way the client touches notes. There is no second path — `NoteList` reads
 * through `listNotesAction` (as an SWR fetcher) and mutates through the two
 * actions below, so search-as-you-type and optimistic updates run on Server
 * Actions like everything else.
 *
 * The route handlers in `app/api/notes/` still exist, but only as the worked
 * example of the *external-consumer* path (see AGENTS.md). Nothing in this app
 * calls them.
 *
 * Shape of each one is fixed: a plain `export async function` whose body is one
 * `runAction` call. `runAction` owns the session check, the schema parse, the
 * error → code mapping and the logging; the handler is only the part specific to
 * this operation. It has to be `export async function` rather than
 * `export const x = wrapper(...)` because a `'use server'` module may only export
 * async functions.
 */

/**
 * Routes live under app/[locale]/, so `revalidatePath` needs the route pattern
 * plus the 'page' type rather than a concrete URL — the literal '/notes' matches
 * no route and would invalidate nothing.
 *
 * Only the mutations call this. It exists for the server-rendered first paint in
 * `notes/page.tsx`; the client's own copy of the list is SWR's, and that gets
 * invalidated separately (see `notesKeyFilter` in swr-keys.ts).
 */
function revalidateNotesPage() {
	revalidatePath('/[locale]/notes', 'page')
}

export async function createNoteAction(
	input: CreateNoteValues,
): Promise<ActionResult<NoteDTO>> {
	return runAction({
		name: 'createNote',
		schema: createNoteSchema,
		input,
		handler: async (parsed, session) => {
			const note = await createNote(session.user.id, parsed)
			revalidateNotesPage()
			return toNoteDTO(note)
		},
	})
}

/**
 * Doubles as `NoteList`'s SWR fetcher.
 *
 * A Server Action being used to *read* is deliberate and is the point of the
 * convention in AGENTS.md: needing to fetch from the client is not a reason to
 * add a Route Handler. No `revalidatePath` here — this reads.
 *
 * Returns the page plus the total, so the caller can tell whether more exist
 * without asking again.
 */
export async function listNotesAction(input: {
	query?: string
	limit?: number
	offset?: number
}): Promise<ActionResult<NotePage>> {
	return runAction({
		name: 'listNotes',
		schema: listNotesSchema,
		input,
		handler: async (parsed, session) => {
			const page = await listNotes(session.user.id, parsed)
			return { items: page.items.map(toNoteDTO), total: page.total }
		},
	})
}

export async function toggleNoteAction(input: {
	id: string
}): Promise<ActionResult<NoteDTO>> {
	return runAction({
		name: 'toggleNote',
		schema: noteIdSchema,
		input,
		handler: async (parsed, session) => {
			const note = await toggleNoteDone(session.user.id, parsed.id)
			revalidateNotesPage()
			return toNoteDTO(note)
		},
	})
}

/**
 * Returns nothing on success — the caller already knows which id it deleted, so
 * there's nothing to send back. `ActionResult<null>` rather than
 * `ActionResult<void>`: the value crosses the network as JSON, and `void` isn't
 * a serializable thing to put in `data`.
 */
export async function deleteNoteAction(input: {
	id: string
}): Promise<ActionResult<null>> {
	return runAction({
		name: 'deleteNote',
		schema: noteIdSchema,
		input,
		handler: async (parsed, session) => {
			await deleteNote(session.user.id, parsed.id)
			revalidateNotesPage()
			return null
		},
	})
}
