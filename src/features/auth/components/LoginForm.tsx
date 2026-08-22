'use client'

import {
	Anchor,
	Button,
	Checkbox,
	Divider,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core'
import { type FormErrors, schemaResolver, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
	IconBrandWechat,
	IconPhone,
	IconShieldCheck,
} from '@tabler/icons-react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
	DEMO_VERIFICATION_CODE,
	type PhoneOtp,
	phoneOtpSchema,
} from '@/core/auth/schema'
import { useRouter } from '@/i18n/navigation'

const RESEND_SECONDS = 60

/**
 * Runs the shared zod schema over the form's values.
 *
 * `{ sync: true }` matters beyond types: it's what makes `form.validate()` and
 * `form.validateField()` return a result instead of a promise, which is what lets
 * "send code" below decide whether to start its countdown in the same tick as the
 * click.
 *
 * Module-level because it depends on nothing but the schema.
 */
const resolvePhoneOtp = schemaResolver(phoneOtpSchema, { sync: true })

/**
 * Which message to show for each field that fails validation.
 *
 * The messages can't come from the schema: `core/auth/schema.ts` deliberately
 * carries no locale-specific text, so what zod produces is an untranslatable
 * English string. Keying off *which* field failed is the whole approach — the same
 * one NoteForm takes for server-reported field errors.
 *
 * A literal map rather than `t(\`${field}Invalid\`)` so next-intl's generated key
 * types check it: rename a message and typecheck fails here.
 */
const FIELD_MESSAGE = {
	phone: 'phoneInvalid',
	code: 'codeInvalid',
} as const satisfies Record<keyof PhoneOtp, string>

/**
 * The interactive half of the sign-in screen. Kept apart from
 * app/[locale]/(auth)/login/page.tsx so that 'use client' stops at the leaf and the
 * page itself stays a Server Component.
 */
export function LoginForm() {
	const t = useTranslations('Login')
	const router = useRouter()
	const [subscribe, setSubscribe] = useState(true)
	const [countdown, setCountdown] = useState(0)
	// Auth.js returns a failure as data, not a thrown error, so a wrong code has no
	// field to attach to — it's form-level.
	const [formError, setFormError] = useState<string | null>(null)

	useEffect(() => {
		if (countdown <= 0) return
		const timer = setInterval(() => setCountdown((s) => s - 1), 1000)
		return () => clearInterval(timer)
	}, [countdown])

	const form = useForm<PhoneOtp>({
		// Mantine's recommended mode: values live in a ref and inputs are
		// uncontrolled, so typing doesn't re-render the form. The price is
		// `key={form.key(...)}` on every input, which is what lets `form.reset()`
		// and `setValues` still reach them.
		mode: 'uncontrolled',
		initialValues: { phone: '', code: '' },
		validate: (values): FormErrors =>
			Object.fromEntries(
				Object.keys(resolvePhoneOtp(values)).map((field) => [
					field,
					t(FIELD_MESSAGE[field as keyof PhoneOtp]),
				]),
			),
	})

	function handleSendCode() {
		// Validate just the phone field before "sending" — there's nothing to send
		// to an obviously malformed number. With a function validator, Mantine runs
		// the whole schema and applies only this field's error, so the code field
		// doesn't light up red before it's been touched.
		if (form.validateField('phone').hasError) return

		// core/auth/otp.ts has no real SMS provider behind it: the code is this fixed
		// constant, so there's no server round trip to make here — just tell the user
		// what to type and start the resend cooldown.
		notifications.show({
			color: 'teal',
			message: t('demoCodeToast', { code: DEMO_VERIFICATION_CODE }),
		})
		setCountdown(RESEND_SECONDS)
	}

	const onSubmit = form.onSubmit(async (values) => {
		setFormError(null)
		// redirect: false so a bad code comes back here instead of bouncing to
		// Auth.js's own error page.
		const result = await signIn('phone-otp', {
			...values,
			redirect: false,
		})

		if (result?.error) {
			setFormError(t('invalidCredentials'))
			return
		}

		// router.refresh() first: the (app) layout's guard reads the session on the
		// server, and without re-fetching it the push can land on a stale render that
		// still thinks nobody is signed in and bounces back to /login.
		router.refresh()
		router.push('/dashboard')
	})

	return (
		/*
		 * noValidate is load-bearing the moment any field gains `required`: the
		 * browser would then refuse to submit and Mantine's validator — the thing
		 * that produces the translated messages below — would never run. Turning
		 * native validation off keeps validity a single mechanism.
		 */
		<form onSubmit={onSubmit} noValidate>
			<Title
				order={1}
				ff="var(--app-font-serif)"
				fz={{ base: 34, sm: 44 }}
				fw={400}
				lh={1.15}
				lts="-0.02em"
			>
				{t('title')}
			</Title>

			<Stack gap="sm" mt="xl">
				<TextInput
					label={t('phoneLabel')}
					type="tel"
					autoComplete="tel"
					placeholder={t('phonePlaceholder')}
					// leftSection is the supported way to put an affix inside a field: it
					// sits inside the input's own border and shifts the text padding, so
					// an absolutely positioned icon isn't needed and can't overlap typing.
					leftSection={<IconPhone size={18} />}
					key={form.key('phone')}
					{...form.getInputProps('phone')}
				/>

				<TextInput
					label={t('codeLabel')}
					inputMode="numeric"
					autoComplete="one-time-code"
					placeholder={t('codePlaceholder')}
					leftSection={<IconShieldCheck size={18} />}
					rightSection={
						<Button
							variant="subtle"
							size="compact-sm"
							disabled={countdown > 0}
							onClick={handleSendCode}
						>
							{countdown > 0
								? t('resendIn', { seconds: countdown })
								: t('sendCode')}
						</Button>
					}
					// Both are required for an interactive right section: the width
					// reserves the room (and sets the input's padding), and
					// pointerEvents="all" undoes the default `none` that keeps decorative
					// sections from swallowing clicks meant for the field.
					rightSectionWidth={112}
					rightSectionPointerEvents="all"
					key={form.key('code')}
					{...form.getInputProps('code')}
				/>

				<Checkbox
					size="sm"
					label={t('subscribeLabel')}
					checked={subscribe}
					onChange={(event) => setSubscribe(event.currentTarget.checked)}
				/>

				{formError && (
					<Text role="alert" c="red" size="sm">
						{formError}
					</Text>
				)}

				{/* form.submitting is set by form.onSubmit for as long as the async
				    handler above is pending — no separate state to keep in sync. */}
				<Button
					type="submit"
					size="md"
					fullWidth
					fw={600}
					loading={form.submitting}
				>
					{t('submit')}
				</Button>

				<Text size="sm" c="dimmed" ta="center">
					{t('demoHint', {
						phone: '13800000000',
						code: DEMO_VERIFICATION_CODE,
					})}
				</Text>

				<Text size="xs" c="dimmed" ta="center">
					{t('termsPrefix')}
					{/* component="button" so these are real buttons, not links to
					    nowhere — they have no href yet. */}
					<Anchor component="button" type="button" size="xs" fw={500}>
						{t('privacyPolicy')}
					</Anchor>
					{t('termsConjunction')}
					<Anchor component="button" type="button" size="xs" fw={500}>
						{t('termsOfService')}
					</Anchor>
				</Text>
			</Stack>

			{/* One component, not two separators around a span: Mantine's Divider takes
			    the label itself. */}
			<Divider label={t('divider')} labelPosition="center" my="lg" />

			{/* Not wired to a provider; see core/auth/config.ts to add one. */}
			<Button
				variant="default"
				size="md"
				fullWidth
				fw={600}
				disabled
				leftSection={<IconBrandWechat size={22} color="#07C160" />}
			>
				{t('wechatButton')}
			</Button>
		</form>
	)
}
