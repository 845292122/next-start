import type { Note } from '@/core/db/schema'

/**
 * The wire shape of a note.
 *
 * This exists because the same rows reach the client two different ways:
 * the notes page passes the service result straight into a Client Component,
 * while SWR fetches it from /api/notes — and `Response.json()` turns
 * `createdAt` from a Date into an ISO string on the way. Without one shape for
 * both, `fallbackData` and the fetched data disagree on the type of that field
 * and the component has to handle both.
 *
 * Everything crossing the server/client boundary goes through here.
 */
export type NoteDTO = {
	id: string
	title: string
	body: string
	done: boolean
	createdAt: string
	updatedAt: string
}

export function toNoteDTO(note: Note): NoteDTO {
	return {
		id: note.id,
		title: note.title,
		body: note.body,
		done: note.done,
		createdAt: note.createdAt.toISOString(),
		updatedAt: note.updatedAt.toISOString(),
	}
}

/**
 * A page of notes plus the total matching the same filter.
 *
 * `total` is what lets the UI say "there are more" without a second round trip;
 * it counts every match, not just the rows in `items`.
 */
export type NotePage = {
	items: NoteDTO[]
	total: number
}
