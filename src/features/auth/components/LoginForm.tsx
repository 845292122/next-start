'use client'

import {
	Button,
	Description,
	FieldError,
	Form,
	InputGroup,
	Label,
	Separator,
	TextField,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Mail, MessageCircle } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { type Credentials, credentialsSchema } from '@/core/auth/schema'
import { useRouter } from '@/i18n/navigation'

/**
 * The interactive half of the sign-in screen. Kept apart from
 * app/[locale]/(auth)/login/page.tsx so that 'use client' stops at the leaf and
 * the page itself stays a Server Component.
 */
export function LoginForm() {
	const t = useTranslations('Login')
	const router = useRouter()
	// Auth.js returns a failure as data, not a thrown error, so the wrong-password
	// case has no field to attach to — it's form-level.
	const [formError, setFormError] = useState<string | null>(null)

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Credentials>({
		resolver: zodResolver(credentialsSchema),
		defaultValues: { email: '', password: '' },
	})

	const onSubmit = handleSubmit(async (values) => {
		setFormError(null)
		// redirect: false so a bad password comes back here instead of bouncing to
		// Auth.js's own error page.
		const result = await signIn('credentials', {
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
		 * "native", and the browser then refuses to submit a malformed
		 * <input type="email"> at all — react-hook-form's resolver never runs and
		 * the zod messages never appear. Set on the Form so every field below
		 * inherits it.
		 */
		<Form
			onSubmit={onSubmit}
			validationBehavior="aria"
			className="flex flex-col gap-0"
		>
			<h1 className="font-serif text-[34px] leading-tight font-normal tracking-tight md:text-[44px]">
				{t('title')}
			</h1>

			{/* WeChat — not wired to a provider; see core/auth/config.ts to add one. */}
			<p className="mt-10 text-sm font-semibold">{t('socialHeading')}</p>
			<Button
				type="button"
				variant="outline"
				size="lg"
				fullWidth
				className="mt-2 font-semibold"
				isDisabled
			>
				<MessageCircle className="size-5.5 text-[#07C160]" />
				{t('socialSubmit')}
			</Button>

			<div className="my-6 flex items-center gap-3">
				<span className="text-sm font-semibold">{t('emailDivider')}</span>
				<Separator className="flex-1" />
			</div>

			<div className="flex flex-col gap-3">
				<TextField isInvalid={!!errors.email}>
					<Label>{t('emailLabel')}</Label>
					{/* InputGroup is the supported way to put an affix inside a field —
					    it owns the focus ring, so an absolutely positioned icon isn't
					    needed and won't fight the border styles. */}
					<InputGroup>
						<InputGroup.Prefix>
							<Mail className="size-5" />
						</InputGroup.Prefix>
						<InputGroup.Input
							type="email"
							autoComplete="email"
							placeholder={t('emailPlaceholder')}
							{...register('email')}
						/>
					</InputGroup>
					<FieldError>{errors.email?.message}</FieldError>
				</TextField>

				<TextField isInvalid={!!errors.password}>
					<Label>{t('passwordLabel')}</Label>
					<InputGroup>
						<InputGroup.Prefix>
							<Lock className="size-5" />
						</InputGroup.Prefix>
						<InputGroup.Input
							type="password"
							autoComplete="current-password"
							placeholder={t('passwordPlaceholder')}
							{...register('password')}
						/>
					</InputGroup>
					<FieldError>{errors.password?.message}</FieldError>
				</TextField>

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
					className="font-semibold"
				>
					{t('submit')}
				</Button>

				{/* The seed account, so the template is clickable out of the box. */}
				<Description className="text-center">{t('demoHint')}</Description>
			</div>

			<div className="mt-8 flex flex-wrap items-center justify-between gap-2">
				<button type="button" className="text-muted cursor-pointer text-sm">
					{t('forgotPassword')}
				</button>
				<div className="flex items-center gap-1.5">
					<span className="text-muted text-sm">{t('noAccount')}</span>
					<button type="button" className="cursor-pointer text-sm font-bold">
						{t('createAccount')}
					</button>
				</div>
			</div>
		</Form>
	)
}
