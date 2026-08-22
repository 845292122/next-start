import { Container, Stack, Text, Title } from '@mantine/core'
import { getRequiredSession } from '@/core/auth/session'
import { listNotes, NOTES_PAGE_SIZE } from '@/core/services/notes-service'
import { NoteForm } from '@/features/notes/components/NoteForm'
import { NoteList } from '@/features/notes/components/NoteList'
import { toNoteDTO } from '@/features/notes/dto'

/**
 * The template's one end-to-end vertical slice: SQLite table → drizzle service →
 * Server Actions (including the search and optimistic updates in NoteList) →
 * Mantine UI.
 *
 * getRequiredSession() throws rather than redirects; the (app) layout has already
 * bounced anyone signed out, so reaching this without a session would be a bug, not
 * a normal path.
 */
export default async function NotesPage() {
	const session = await getRequiredSession()

	// The first page only. `listNotes` is always bounded — see notes-service.ts.
	const page = await listNotes(session.user.id, { limit: NOTES_PAGE_SIZE })

	return (
		<Container size="md" py={{ base: 'md', sm: 'xl' }}>
			<Stack gap="xl">
				<div>
					<Title order={2}>笔记</Title>
					<Text size="sm" c="dimmed" mt={4}>
						模板自带的完整示例：SQLite 表 → drizzle service → Server
						Action（连搜索和乐观更新也是）→ Mantine
						界面。不需要的话整个域可以删掉。
					</Text>
				</div>

				<NoteForm />

				{/* Everything crossing to the client goes through the DTO. */}
				<NoteList
					initial={{ items: page.items.map(toNoteDTO), total: page.total }}
					pageSize={NOTES_PAGE_SIZE}
				/>
			</Stack>
		</Container>
	)
}
