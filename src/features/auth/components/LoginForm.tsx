'use client'

import {
	Button,
	Checkbox,
	Description,
	FieldError,
	Form,
	InputGroup,
	Label,
	Separator,
	TextField,
	toast,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
	DEMO_VERIFICATION_CODE,
	type PhoneOtp,
	phoneOtpSchema,
} from '@/core/auth/schema'
import { useRouter } from '@/i18n/navigation'

const RESEND_SECONDS = 60

/**
 * The interactive half of the sign-in screen. Kept apart from
 * app/[locale]/(auth)/login/page.tsx so that 'use client' stops at the leaf and
 * the page itself stays a Server Component.
 */
export function LoginForm() {
	const t = useTranslations('Login')
	const router = useRouter()
	const [subscribe, setSubscribe] = useState(true)
	const [countdown, setCountdown] = useState(0)
	// Auth.js returns a failure as data, not a thrown error, so a wrong code has
	// no field to attach to — it's form-level.
	const [formError, setFormError] = useState<string | null>(null)

	useEffect(() => {
		if (countdown <= 0) return
		const timer = setInterval(() => setCountdown((s) => s - 1), 1000)
		return () => clearInterval(timer)
	}, [countdown])

	const {
		register,
		handleSubmit,
		trigger,
		formState: { errors, isSubmitting },
	} = useForm<PhoneOtp>({
		resolver: zodResolver(phoneOtpSchema),
		defaultValues: { phone: '', code: '' },
	})

	async function handleSendCode() {
		// Validate just the phone field before "sending" — there's nothing to
		// send to an obviously malformed number.
		const phoneIsValid = await trigger('phone')
		if (!phoneIsValid) return

		// core/auth/otp.ts has no real SMS provider behind it: the code is this
		// fixed constant, so there's no server round trip to make here — just
		// tell the user what to type and start the resend cooldown.
		toast.success(t('demoCodeToast', { code: DEMO_VERIFICATION_CODE }))
		setCountdown(RESEND_SECONDS)
	}

	const onSubmit = handleSubmit(async (values) => {
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
		// server, and without re-fetching it the push can land on a stale render
		// that still thinks nobody is signed in and bounces back to /login.
		router.refresh()
		router.push('/dashboard')
	})

	return (
		/*
		 * validationBehavior="aria" is load-bearing: RAC's Form defaults to
		 * "native", and the browser then refuses to submit a malformed field at
		 * all — react-hook-form's resolver never runs and the messages below
		 * never appear. Set on the Form so every field inherits it.
		 */
		<Form
			onSubmit={onSubmit}
			validationBehavior="aria"
			className="flex flex-col gap-0"
		>
			<h1 className="font-serif text-[34px] leading-tight font-normal tracking-tight md:text-[44px]">
				{t('title')}
			</h1>

			<div className="mt-8 flex flex-col gap-3">
				<TextField isInvalid={!!errors.phone}>
					<Label>{t('phoneLabel')}</Label>
					{/* InputGroup is the supported way to put an affix inside a field —
					    it owns the focus ring, so an absolutely positioned icon isn't
					    needed and won't fight the border styles. */}
					<InputGroup>
						<InputGroup.Prefix>
							<Phone className="size-5" />
						</InputGroup.Prefix>
						<InputGroup.Input
							type="tel"
							autoComplete="tel"
							placeholder={t('phonePlaceholder')}
							{...register('phone')}
						/>
					</InputGroup>
					{/* No error.message here — see core/auth/schema.ts on why the
					    schema carries no locale-specific text. */}
					<FieldError>{errors.phone && t('phoneInvalid')}</FieldError>
				</TextField>

				<TextField isInvalid={!!errors.code}>
					<Label>{t('codeLabel')}</Label>
					<InputGroup>
						<InputGroup.Prefix>
							<ShieldCheck className="size-5" />
						</InputGroup.Prefix>
						<InputGroup.Input
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder={t('codePlaceholder')}
							{...register('code')}
						/>
						<InputGroup.Suffix>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								isDisabled={countdown > 0}
								onPress={handleSendCode}
							>
								{countdown > 0
									? t('resendIn', { seconds: countdown })
									: t('sendCode')}
							</Button>
						</InputGroup.Suffix>
					</InputGroup>
					<FieldError>{errors.code && t('codeInvalid')}</FieldError>
				</TextField>

				<Checkbox isSelected={subscribe} onChange={setSubscribe}>
					<Checkbox.Content className="items-center gap-2">
						<Checkbox.Control>
							<Checkbox.Indicator />
						</Checkbox.Control>
						<span className="text-sm">{t('subscribeLabel')}</span>
					</Checkbox.Content>
				</Checkbox>

				{formError && (
					<p role="alert" className="text-danger text-sm">
						{formError}
					</p>
				)}

				<Button
					type="submit"
					size="lg"
					fullWidth
					isPending={isSubmitting}
					className="font-semibold button--shadow"
				>
					{t('submit')}
				</Button>

				<Description className="text-center">
					{t('demoHint', {
						phone: '13800000000',
						code: DEMO_VERIFICATION_CODE,
					})}
				</Description>

				<p className="text-muted text-center text-xs leading-relaxed">
					{t('termsPrefix')}
					<button type="button" className="cursor-pointer font-medium">
						{t('privacyPolicy')}
					</button>
					{t('termsConjunction')}
					<button type="button" className="cursor-pointer font-medium">
						{t('termsOfService')}
					</button>
				</p>
			</div>

			<div className="my-6 flex items-center gap-3">
				<Separator className="flex-1" />
				<span className="text-muted text-sm">{t('divider')}</span>
				<Separator className="flex-1" />
			</div>

			{/* Not wired to a provider; see core/auth/config.ts to add one. */}
			<Button
				type="button"
				variant="outline"
				size="lg"
				fullWidth
				className="font-semibold"
				isDisabled
			>
				<MessageCircle className="size-5.5 text-[#07C160]" />
				{t('wechatButton')}
			</Button>
		</Form>
	)
}
