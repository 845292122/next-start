import { auth } from '@/core/auth'
import { createNote, listNotes } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'
import { createNoteSchema } from '@/features/notes/schema'

// Route handlers don't run layouts, so the (app) group's auth guard doesn't
// apply here — each handler checks the session itself.

export async function GET(request: Request) {
	const session = await auth()
	if (!session?.user)
		return Response.json({ error: 'unauthorized' }, { status: 401 })

	const query = new URL(request.url).searchParams.get('q') ?? undefined
	const notes = await listNotes(session.user.id, query)
	return Response.json(notes.map(toNoteDTO))
}

export async function POST(request: Request) {
	const session = await auth()
	if (!session?.user)
		return Response.json({ error: 'unauthorized' }, { status: 401 })

	const body = createNoteSchema.parse(await request.json())
	const note = await createNote(session.user.id, body)
	return Response.json(toNoteDTO(note), { status: 201 })
}
