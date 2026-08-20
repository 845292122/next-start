import { getTranslations } from 'next-intl/server'
import { getRequiredSession } from '@/core/auth/session'
import { listNotes } from '@/core/services/notes-service'
import { NoteForm } from '@/features/notes/components/NoteForm'
import { NoteList } from '@/features/notes/components/NoteList'
import { toNoteDTO } from '@/features/notes/dto'

/**
 * The template's one end-to-end vertical slice: SQLite table → drizzle service →
 * both exposure paths (Server Action in NoteForm, route handler + SWR in
 * NoteList) → HeroUI UI.
 *
 * getRequiredSession() throws rather than redirects; the (app) layout has
 * already bounced anyone signed out, so reaching this without a session would be
 * a bug, not a normal path.
 */
export default async function NotesPage() {
	const [session, t] = await Promise.all([
		getRequiredSession(),
		getTranslations('Notes'),
	])

	const notes = await listNotes(session.user.id)

	return (
		<div className="mx-auto max-w-180 p-4 md:p-8">
			<div className="flex flex-col gap-8">
				<div>
					<h2 className="text-2xl font-bold">{t('title')}</h2>
					<p className="text-muted mt-1 text-sm">{t('description')}</p>
				</div>

				<NoteForm />

				{/* Everything crossing to the client goes through the DTO. */}
				<NoteList initial={notes.map(toNoteDTO)} />
			</div>
		</div>
	)
}
