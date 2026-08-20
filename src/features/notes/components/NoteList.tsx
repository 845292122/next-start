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
import type { NoteDTO } from '@/features/notes/dto'
import { notesKey } from '@/features/notes/swr-keys'

/**
 * Exposure path B: SWR against the route handlers in app/api/notes/.
 *
 * This is the path for anything that needs search-as-you-type or optimistic
 * updates; the plain server-render + Server Action path is NoteForm's.
 */
export function NoteList({ initial }: { initial: NoteDTO[] }) {
	const t = useTranslations('Notes')
	const format = useFormatter()
	const [query, setQuery] = useState('')

	const {
		data: notes,
		isLoading,
		mutate,
	} = useSWR<NoteDTO[]>(notesKey(query), {
		// The unfiltered list was already server-rendered by the page, so the first
		// paint needs no request. A search narrows the key, which legitimately
		// misses the cache and fetches.
		fallbackData: query ? undefined : initial,
		keepPreviousData: true,
	})

	async function toggle(note: NoteDTO) {
		// Optimistic: flip locally, then let the response confirm. `revalidate`
		// stays on so a failed PATCH rolls the row back.
		await mutate(
			async () => {
				const res = await fetch(`/api/notes/${note.id}`, { method: 'PATCH' })
				if (!res.ok) throw new Error('toggle failed')
				return undefined
			},
			{
				optimisticData: (current = []) =>
					current.map((n) => (n.id === note.id ? { ...n, done: !n.done } : n)),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch(() => toast.danger(t('updateFailed')))
	}

	async function remove(note: NoteDTO) {
		await mutate(
			async () => {
				const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
				if (!res.ok) throw new Error('delete failed')
				return undefined
			},
			{
				optimisticData: (current = []) =>
					current.filter((n) => n.id !== note.id),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch(() => toast.danger(t('deleteFailed')))
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
