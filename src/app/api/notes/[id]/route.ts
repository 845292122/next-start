import { auth } from '@/core/auth'
import { deleteNote, toggleNoteDone } from '@/core/services/notes-service'
import { toNoteDTO } from '@/features/notes/dto'

export async function PATCH(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth()
	if (!session?.user)
		return Response.json({ error: 'unauthorized' }, { status: 401 })

	const { id } = await params
	const note = await toggleNoteDone(session.user.id, id)
	return Response.json(toNoteDTO(note))
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth()
	if (!session?.user)
		return Response.json({ error: 'unauthorized' }, { status: 401 })

	const { id } = await params
	await deleteNote(session.user.id, id)
	return new Response(null, { status: 204 })
}
