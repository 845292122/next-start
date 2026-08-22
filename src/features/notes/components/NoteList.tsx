'use client'

import {
	ActionIcon,
	Button,
	Center,
	Checkbox,
	CloseButton,
	EmptyState,
	Group,
	Loader,
	Paper,
	Stack,
	Text,
	TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
	MagnifyingGlassIcon,
	NotePencilIcon,
	TrashIcon,
} from '@phosphor-icons/react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import useSWR from 'swr'
import {
	deleteNoteAction,
	listNotesAction,
	toggleNoteAction,
} from '@/features/notes/actions'
import type { NoteDTO, NotePage } from '@/features/notes/dto'
import { notesKey } from '@/features/notes/swr-keys'
import { useActionErrorMessage } from '@/lib/action-error'

/**
 * Search-as-you-type and optimistic updates, all on Server Actions.
 *
 * There used to be a second exposure path here — SWR against the route handlers in
 * `app/api/notes/`. It's gone: a Server Action works fine as an SWR fetcher, so
 * "the client needs to trigger this fetch" was never a reason to add a Route
 * Handler (see AGENTS.md). Those handlers remain as the worked example of the
 * external-consumer path, but nothing in this app calls them.
 */
export function NoteList({
	initial,
	pageSize,
}: {
	initial: NotePage
	/** The service's default page size, passed down so the two can't drift. */
	pageSize: number
}) {
	const t = useTranslations('Notes')
	const format = useFormatter()
	const errorMessage = useActionErrorMessage()
	const [query, setQuery] = useState('')
	// Grows the window rather than paging: one SWR cache entry per (query, limit),
	// so the optimistic toggle/delete below stay simple — they only ever have one
	// list to patch. A page-numbered UI would pass `offset` instead, which the
	// action already accepts.
	const [limit, setLimit] = useState(pageSize)

	const {
		data: page,
		isLoading,
		mutate,
	} = useSWR(
		notesKey(query, limit),
		// An explicit fetcher, because the key is a tuple rather than a URL. The
		// ActionResult is unwrapped here so that everything below this line deals in
		// plain data: a failure becomes a thrown error, which is what SWR's own
		// error/rollback handling is built around.
		async ([, q, take]) => {
			const result = await listNotesAction({
				query: q || undefined,
				limit: take,
			})
			if (!result.ok) throw new Error(errorMessage(result))
			return result.data
		},
		{
			// The first page was already server-rendered, so the first paint needs no
			// request. A search or a bigger window narrows the key, which legitimately
			// misses the cache and fetches.
			fallbackData: query || limit !== pageSize ? undefined : initial,
			keepPreviousData: true,
			onError: (error: Error) =>
				notifications.show({ color: 'red', message: error.message }),
		},
	)

	async function toggle(note: NoteDTO) {
		// Optimistic: flip locally, then let the response confirm. `revalidate` stays
		// on so a failed toggle rolls the row back.
		await mutate(
			async () => {
				const result = await toggleNoteAction({ id: note.id })
				if (!result.ok) throw new Error(errorMessage(result))
				return undefined
			},
			{
				optimisticData: (current) => ({
					total: current?.total ?? 0,
					items: (current?.items ?? []).map((n) =>
						n.id === note.id ? { ...n, done: !n.done } : n,
					),
				}),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch((error: Error) =>
			notifications.show({ color: 'red', message: error.message }),
		)
	}

	async function remove(note: NoteDTO) {
		await mutate(
			async () => {
				const result = await deleteNoteAction({ id: note.id })
				if (!result.ok) throw new Error(errorMessage(result))
				return undefined
			},
			{
				optimisticData: (current) => ({
					// The total drops too, or the "load more" hint would still claim
					// there's another row behind the one just removed.
					total: Math.max((current?.total ?? 1) - 1, 0),
					items: (current?.items ?? []).filter((n) => n.id !== note.id),
				}),
				rollbackOnError: true,
				populateCache: false,
			},
		).catch((error: Error) =>
			notifications.show({ color: 'red', message: error.message }),
		)
	}

	return (
		<Stack gap="md">
			{/*
			 * type="search" is not cosmetic: it's what gives the input
			 * role="searchbox", which is how the e2e suite finds it and how assistive
			 * tech announces it.
			 */}
			<TextInput
				type="search"
				value={query}
				onChange={(event) => setQuery(event.currentTarget.value)}
				aria-label={t('searchLabel')}
				placeholder={t('searchPlaceholder')}
				leftSection={<MagnifyingGlassIcon size={16} />}
				rightSection={
					query ? (
						<CloseButton
							size="sm"
							aria-label={t('searchClear')}
							onClick={() => setQuery('')}
						/>
					) : undefined
				}
				rightSectionPointerEvents="all"
			/>

			{isLoading && !page ? (
				<Center p="xl">
					<Loader />
				</Center>
			) : page?.items.length ? (
				<Stack component="ul" gap="xs" p={0} style={{ listStyle: 'none' }}>
					{page.items.map((note) => (
						<Paper key={note.id} component="li" withBorder radius="md" p="md">
							<Group align="flex-start" gap="sm" wrap="nowrap">
								{/*
								 * Mantine's Checkbox is a real, visible <input
								 * type="checkbox"> — no hidden input under a styled proxy — so
								 * a click lands on the same element the assertions read.
								 */}
								<Checkbox
									mt={2}
									checked={note.done}
									onChange={() => toggle(note)}
									aria-label={t('toggleLabel', { title: note.title })}
								/>
								<div style={{ minWidth: 0, flex: 1 }}>
									<Text
										fw={500}
										td={note.done ? 'line-through' : undefined}
										c={note.done ? 'dimmed' : undefined}
									>
										{note.title}
									</Text>
									{note.body && (
										<Text
											size="sm"
											c="dimmed"
											mt={2}
											style={{ wordBreak: 'break-word' }}
										>
											{note.body}
										</Text>
									)}
									<Text size="xs" c="dimmed" mt={4}>
										{/*
										 * createdAt is an ISO string, not a Date — see
										 * features/notes/dto.ts for why. next-intl's formatter needs
										 * a Date, hence the parse here.
										 */}
										{format.dateTime(new Date(note.createdAt), {
											dateStyle: 'medium',
											timeStyle: 'short',
										})}
									</Text>
								</div>
								<ActionIcon
									variant="subtle"
									color="red"
									aria-label={t('deleteLabel', { title: note.title })}
									onClick={() => remove(note)}
								>
									<TrashIcon size={16} />
								</ActionIcon>
							</Group>
						</Paper>
					))}
				</Stack>
			) : (
				<EmptyState
					py="xl"
					icon={<NotePencilIcon size={32} />}
					title={query ? t('noResults') : t('empty')}
					description={query ? t('noResultsHint') : t('emptyHint')}
				/>
			)}

			{/*
			 * Only rendered when the server says there are more rows than we hold.
			 * `total` counts every match, so this is honest under a search filter too.
			 */}
			{page && page.total > page.items.length && (
				<Button
					variant="default"
					loading={isLoading}
					onClick={() => setLimit((current) => current + pageSize)}
					style={{ alignSelf: 'center' }}
				>
					{t('loadMore', { remaining: page.total - page.items.length })}
				</Button>
			)}
		</Stack>
	)
}
