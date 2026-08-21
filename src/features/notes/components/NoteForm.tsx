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
import { notesKeyFilter } from '@/features/notes/swr-keys'
import { useActionErrorMessage } from '@/lib/action-error'

/**
 * The reference implementation for consuming `ActionResult` in a form: a failure
 * that names fields lands on those fields, and everything else becomes a toast.
 */
export function NoteForm() {
	const t = useTranslations('Notes')
	const { mutate } = useSWRConfig()
	const errorMessage = useActionErrorMessage()

	// Three generics, not one: `body` has a zod .default(''), so the schema's
	// input type (body optional) and output type (body always a string) differ,
	// and useForm has to be told both or the resolver won't line up.
	const {
		register,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<CreateNoteValues, unknown, CreateNoteInput>({
		resolver: zodResolver(createNoteSchema),
		defaultValues: { title: '', body: '' },
	})

	const onSubmit = handleSubmit(async (values) => {
		// Two distinct failure modes, hence both a result check and a catch:
		// `createNoteAction` reports *expected* failures as `{ ok: false }` (see
		// core/action-result.ts), while a dead network or a crashed server still
		// makes the call itself throw.
		let result: Awaited<ReturnType<typeof createNoteAction>>
		try {
			result = await createNoteAction(values)
		} catch {
			toast.danger(t('createFailed'))
			return
		}

		if (!result.ok) {
			// A failure carrying field names belongs on those fields, not in a toast
			// — `fields` exists precisely so the server can say *where* without
			// sending untranslatable text (see core/action-result.ts).
			//
			// Reaching this in practice means the request was tampered with or the
			// schema drifted, because the same schema already ran client-side through
			// zodResolver. It's the defence-in-depth path, not the everyday one.
			if (result.fields?.length) {
				for (const field of result.fields) {
					if (field === 'title' || field === 'body') {
						setError(field, { message: t(`${field}Invalid`) })
					}
				}
				return
			}

			toast.danger(errorMessage(result))
			return
		}

		// Revalidate rather than write `result.data` in by hand: the list is sorted
		// by createdAt and filtered by the search box, so the server is the only
		// thing that knows where the new note belongs.
		//
		// The *filter*, not notesKey() — a note has to appear in whatever query the
		// search box currently holds, and that's a different cache key.
		await mutate(notesKeyFilter)
		reset()
		toast.success(t('created'))
	})

	return (
		<Form onSubmit={onSubmit} className="flex flex-col gap-3">
			<TextField isInvalid={!!errors.title}>
				<Label>{t('titleLabel')}</Label>
				<Input placeholder={t('titlePlaceholder')} {...register('title')} />
				{/*
				 * t('titleInvalid'), not errors.title?.message: the message on a
				 * resolver error is zod's own English string, and schemas in this
				 * project deliberately carry no locale-specific text (see
				 * core/auth/schema.ts). Keying off *which* field failed is the same
				 * approach LoginForm takes.
				 */}
				<FieldError>{errors.title && t('titleInvalid')}</FieldError>
			</TextField>

			<TextField isInvalid={!!errors.body}>
				<Label>{t('bodyLabel')}</Label>
				<TextArea
					rows={3}
					placeholder={t('bodyPlaceholder')}
					{...register('body')}
				/>
				<FieldError>{errors.body && t('bodyInvalid')}</FieldError>
			</TextField>

			<Button type="submit" isPending={isSubmitting} className="self-start">
				<Plus className="size-4" />
				{t('submit')}
			</Button>
		</Form>
	)
}
