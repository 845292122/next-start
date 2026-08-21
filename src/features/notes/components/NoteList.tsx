'use client'

import {
	Button,
	Checkbox,
	EmptyState,
	SearchField,
	Spinner,
	toast,
} from '@heroui/react'
import { NotebookPen, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import useSWR from 'swr'
import {
	deleteNoteAction,
	listNotesAction,
	toggleNoteAction,
} from '@/features/notes/actions'
import type { NoteDTO } from '@/features/notes/dto'
import { notesKey } from '@/features/notes/swr-keys'
import { useActionErrorMessage } from '@/lib/action-error'

/**
 * Search-as-you-type and optimistic updates, all on Server Actions.
 *
 * There used to be a second exposure path here — SWR against the route handlers
 * in `app/api/notes/`. It's gone: a Server Action works fine as an SWR fetcher,
 * so "the client needs to trigger this fetch" was never a reason to add a Route
 * Handler (see AGENTS.md). Those handlers remain as the worked example of the
 * external-consumer path, but nothing in this app calls them.
 */
export function NoteList({ initial }: { initial: NoteDTO[] }) {
	const t = useTranslations('Notes')
	const format = useFormatter()
	const errorMessage = useActionErrorMessage()
	const [query, setQuery] = useState('')

	const {
		data: notes,
		isLoading,
		mutate,
	} = useSWR(
		notesKey(query),
		// An explicit fetcher, because the key is a tuple rather than a URL. The
		// ActionResult is unwrapped here so that everything below this line deals in
		// plain data: a failure becomes a thrown error, which is what SWR's own
		// error/rollback handling is built around.
		async ([, q]) => {
			const result = await listNotesAction({ query: q || undefined })
			if (!result.ok) throw new Error(errorMessage(result))
			return result.data
		},
		{
			// The unfiltered list was already server-rendered by the page, so the
			// first paint needs no request. A search narrows the key, which
			// legitimately misses the cache and fetches.
			fallbackData: query ? undefined : initial,
			keepPreviousData: true,
			onError: (error: Error) => toast.danger(error.message),
		},
	)

	async function toggle(note: NoteDTO) {
		// Optimistic: flip locally, then let the response confirm. `revalidate`
		// stays on so a failed toggle rolls the row back.
		await mutate(
			async () => {
				const result = await toggleNoteAction({ id: note.id })
				if (!result.ok) throw new Error(errorMessage(result))
				return undefined
			},
			{
				optimisticData: (current = []) =>
					current.map((n) => (n.id === note.id ? { ...n, done: !n.done } : n)),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch((error: Error) => toast.danger(error.message))
	}

	async function remove(note: NoteDTO) {
		await mutate(
			async () => {
				const result = await deleteNoteAction({ id: note.id })
				if (!result.ok) throw new Error(errorMessage(result))
				return undefined
			},
			{
				optimisticData: (current = []) =>
					current.filter((n) => n.id !== note.id),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch((error: Error) => toast.danger(error.message))
	}

	return (
		<div className="flex flex-col gap-4">
			<SearchField
				value={query}
				onChange={setQuery}
				aria-label={t('searchLabel')}
			>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input placeholder={t('searchPlaceholder')} />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>

			{isLoading && !notes ? (
				<div className="flex justify-center p-8">
					<Spinner />
				</div>
			) : notes?.length ? (
				<ul className="flex flex-col gap-2">
					{notes.map((note) => (
						<li
							key={note.id}
							className="border-border bg-surface flex items-start gap-3 rounded-xl border p-4"
						>
							{/*
							 * Checkbox.Content is the interactive element (react-aria's
							 * CheckboxButton), so the control has to sit inside it —
							 * putting Control directly under Checkbox renders a box with
							 * nothing to click and no `checkbox` role.
							 */}
							<Checkbox
								isSelected={note.done}
								onChange={() => toggle(note)}
								aria-label={t('toggleLabel', { title: note.title })}
								className="mt-0.5"
							>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
								</Checkbox.Content>
							</Checkbox>
							<div className="min-w-0 flex-1">
								<p
									className={
										note.done
											? 'text-muted font-medium line-through'
											: 'font-medium'
									}
								>
									{note.title}
								</p>
								{note.body && (
									<p className="text-muted mt-0.5 text-sm break-words">
										{note.body}
									</p>
								)}
								<p className="text-muted mt-1 text-xs">
									{/*
									 * createdAt is an ISO string, not a Date — see
									 * features/notes/dto.ts for why. next-intl's formatter needs a
									 * Date, hence the parse here.
									 */}
									{format.dateTime(new Date(note.createdAt), {
										dateStyle: 'medium',
										timeStyle: 'short',
									})}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								isIconOnly
								aria-label={t('deleteLabel', { title: note.title })}
								onPress={() => remove(note)}
							>
								<Trash2 className="text-danger size-4" />
							</Button>
						</li>
					))}
				</ul>
			) : (
				<EmptyState className="py-10">
					<NotebookPen className="text-muted size-8" />
					<p className="mt-3 font-medium">
						{query ? t('noResults') : t('empty')}
					</p>
					<p className="text-muted text-sm">
						{query ? t('noResultsHint') : t('emptyHint')}
					</p>
				</EmptyState>
			)}
		</div>
	)
}
