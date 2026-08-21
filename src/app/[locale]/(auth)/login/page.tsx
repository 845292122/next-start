import { LoginHero } from '@/components/ui/LoginHero'
import { LoginForm } from '@/features/auth/components/LoginForm'

/**
 * Sign-in screen: full-bleed split — decorative panel on the left half, phone
 * + verification-code form on the right — with no card around it.
 *
 * A Server Component: only the form needs client state, and it's its own
 * component for exactly that reason.
 */
export default function LoginPage() {
	return (
		// 100dvh, not 100vh: mobile browser chrome would otherwise push the form
		// past the bottom of the screen.
		<div className="flex min-h-dvh items-stretch">
			{/* Dropped below md — the form is the point on a phone. */}
			<div className="m-6 hidden flex-1 md:flex">
				<LoginHero />
			</div>

			<div className="flex flex-1 items-center justify-center px-6 py-8 md:px-8">
				<div className="w-full max-w-97.5">
					<LoginForm />
				</div>
			</div>
		</div>
	)
}
