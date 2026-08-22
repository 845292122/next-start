'use client'

import { Button, Stack, Textarea, TextInput } from '@mantine/core'
import { type FormErrors, schemaResolver, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { PlusIcon } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useSWRConfig } from 'swr'
import { createNoteAction } from '@/features/notes/actions'
import {
	type CreateNoteValues,
	createNoteSchema,
} from '@/features/notes/schema'
import { notesKeyFilter } from '@/features/notes/swr-keys'
import { useActionErrorMessage } from '@/lib/action-error'

/** See the note in features/auth/components/LoginForm.tsx on `{ sync: true }`. */
const resolveCreateNote = schemaResolver(createNoteSchema, { sync: true })

/**
 * Which message belongs to which field — for both the client-side schema run and
 * the server's `fields` reply, because they name the same fields.
 *
 * The schema carries no locale text (see core/auth/schema.ts), so the wording has
 * to be looked up by field name. Spelled out as a literal map so next-intl
 * typechecks the keys.
 */
const FIELD_MESSAGE = {
	title: 'titleInvalid',
	body: 'bodyInvalid',
} as const satisfies Record<keyof CreateNoteValues, string>

/**
 * The reference implementation for consuming `ActionResult` in a form: a failure
 * that names fields lands on those fields, and everything else becomes a
 * notification.
 */
export function NoteForm() {
	const t = useTranslations('Notes')
	const { mutate } = useSWRConfig()
	const errorMessage = useActionErrorMessage()

	const form = useForm<CreateNoteValues>({
		mode: 'uncontrolled',
		initialValues: { title: '', body: '' },
		validate: (values): FormErrors =>
			Object.fromEntries(
				Object.keys(resolveCreateNote(values)).map((field) => [
					field,
					t(FIELD_MESSAGE[field as keyof CreateNoteValues]),
				]),
			),
	})

	const onSubmit = form.onSubmit(async (values) => {
		// Two distinct failure modes, hence both a result check and a catch:
		// `createNoteAction` reports *expected* failures as `{ ok: false }` (see
		// core/action-result.ts), while a dead network or a crashed server still
		// makes the call itself throw.
		let result: Awaited<ReturnType<typeof createNoteAction>>
		try {
			result = await createNoteAction(values)
		} catch {
			notifications.show({ color: 'red', message: t('createFailed') })
			return
		}

		if (!result.ok) {
			// A failure carrying field names belongs on those fields, not in a
			// notification — `fields` exists precisely so the server can say *where*
			// without sending untranslatable text (see core/action-result.ts).
			//
			// Reaching this in practice means the request was tampered with or the
			// schema drifted, because the same schema already ran client-side through
			// the resolver above. It's the defence-in-depth path, not the everyday one.
			if (result.fields?.length) {
				for (const field of result.fields) {
					if (field === 'title' || field === 'body') {
						form.setFieldError(field, t(FIELD_MESSAGE[field]))
					}
				}
				return
			}

			notifications.show({ color: 'red', message: errorMessage(result) })
			return
		}

		// Revalidate rather than write `result.data` in by hand: the list is sorted by
		// createdAt and filtered by the search box, so the server is the only thing
		// that knows where the new note belongs.
		//
		// The *filter*, not notesKey() — a note has to appear in whatever query the
		// search box currently holds, and that's a different cache key.
		await mutate(notesKeyFilter)
		form.reset()
		notifications.show({ color: 'teal', message: t('created') })
	})

	return (
		<form onSubmit={onSubmit} noValidate>
			<Stack gap="sm">
				<TextInput
					label={t('titleLabel')}
					placeholder={t('titlePlaceholder')}
					key={form.key('title')}
					{...form.getInputProps('title')}
				/>

				<Textarea
					label={t('bodyLabel')}
					placeholder={t('bodyPlaceholder')}
					rows={3}
					key={form.key('body')}
					{...form.getInputProps('body')}
				/>

				<Button
					type="submit"
					loading={form.submitting}
					leftSection={<PlusIcon size={16} />}
					style={{ alignSelf: 'flex-start' }}
				>
					{t('submit')}
				</Button>
			</Stack>
		</form>
	)
}
