'use client'

import {
	Button,
	FieldError,
	Form,
	Input,
	Label,
	TextArea,
	TextField,
	toast,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { useSWRConfig } from 'swr'
import { createNoteAction } from '@/features/notes/actions'
import {
	type CreateNoteInput,
	type CreateNoteValues,
	createNoteSchema,
} from '@/features/notes/schema'
import { notesKey } from '@/features/notes/swr-keys'

/**
 * Exposure path A: a Server Action.
 *
 * The action revalidates the page on the server, but NoteList reads from SWR, so
 * the new row also has to be pushed into that cache — mutate() below. Doing only
 * one of the two leaves either a stale list or a stale server render.
 */
export function NoteForm() {
	const t = useTranslations('Notes')
	const { mutate } = useSWRConfig()

	// Three generics, not one: `body` has a zod .default(''), so the schema's
	// input type (body optional) and output type (body always a string) differ,
	// and useForm has to be told both or the resolver won't line up.
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateNoteValues, unknown, CreateNoteInput>({
		resolver: zodResolver(createNoteSchema),
		defaultValues: { title: '', body: '' },
	})

	const onSubmit = handleSubmit(async (values) => {
		try {
			await createNoteAction(values)
			// Revalidate rather than write the returned row in by hand: the list is
			// sorted by createdAt and filtered by the search box, so the server is
			// the only thing that knows where the new note belongs.
			await mutate(notesKey())
			reset()
			toast.success(t('created'))
		} catch {
			toast.danger(t('createFailed'))
		}
	})

	return (
		<Form onSubmit={onSubmit} className="flex flex-col gap-3">
			<TextField isInvalid={!!errors.title}>
				<Label>{t('titleLabel')}</Label>
				<Input placeholder={t('titlePlaceholder')} {...register('title')} />
				<FieldError>{errors.title?.message}</FieldError>
			</TextField>

			<TextField isInvalid={!!errors.body}>
				<Label>{t('bodyLabel')}</Label>
				<TextArea
					rows={3}
					placeholder={t('bodyPlaceholder')}
					{...register('body')}
				/>
				<FieldError>{errors.body?.message}</FieldError>
			</TextField>

			<Button type="submit" isPending={isSubmitting} className="self-start">
				<Plus className="size-4" />
				{t('submit')}
			</Button>
		</Form>
	)
}
