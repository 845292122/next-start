import { getTranslations } from 'next-intl/server'
import { SignInArt } from '@/components/ui/SignInArt'
import { LoginForm } from '@/features/auth/components/LoginForm'

/**
 * Sign-in screen: WeChat on top (not wired), email + password below. Full-bleed
 * split — artwork on the left half, form on the right — with no card around it.
 *
 * A Server Component: only the form needs client state, and it's its own
 * component for exactly that reason.
 */
export default async function LoginPage() {
	const t = await getTranslations('Login')

	return (
		// 100dvh, not 100vh: mobile browser chrome would otherwise push the form
		// past the bottom of the screen.
		<div className="flex min-h-dvh items-stretch">
			{/* Artwork. Dropped below md — the form is the point on a phone. */}
			<div className="bg-surface-secondary m-6 hidden flex-1 items-center justify-center overflow-hidden rounded-2xl p-8 md:flex">
				{/*
				 * Definite height so the SVG can size itself against it: the panel
				 * stretches to the row, this caps the drawing on tall screens and lets
				 * it shrink on short ones.
				 */}
				<div className="h-full max-h-140 w-full max-w-105">
					<SignInArt label={t('artLabel')} />
				</div>
			</div>

			<div className="flex flex-1 items-center justify-center px-6 py-8 md:px-8">
				<div className="w-full max-w-97.5">
					<LoginForm />
				</div>
			</div>
		</div>
	)
}
