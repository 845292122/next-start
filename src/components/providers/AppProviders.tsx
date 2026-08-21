'use client'

import { I18nProvider, RouterProvider, Toast } from '@heroui/react'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { useLocale } from 'next-intl'
import { ThemeProvider } from 'next-themes'
import { useRouter } from '@/i18n/navigation'

/**
 * Every client-side provider the app needs, in one place. HeroUI v3 has no
 * single HeroUIProvider of its own — it's built on react-aria-components, whose
 * concerns (routing, locale, toast queue) are separate providers.
 */
export function AppProviders({
	children,
	session,
	nonce,
}: {
	children: React.ReactNode
	session: Session | null
	/**
	 * The CSP nonce, read from the request by `app/[locale]/layout.tsx`.
	 *
	 * Only next-themes needs it: it renders its own inline `<script>`, and a
	 * nonce-based CSP blocks that unless it's tagged. Everything Next generates
	 * gets a nonce automatically.
	 */
	nonce?: string
}) {
	const locale = useLocale()
	const router = useRouter()

	return (
		<SessionProvider session={session}>
			{/*
			 * attribute="class" writes class="light" / class="dark" on <html>, which
			 * is exactly what HeroUI's theme variables key off (see
			 * @heroui/styles/dist/themes/default/variables.css).
			 *
			 * next-themes rather than HeroUI's own useTheme(): that hook applies the
			 * theme in a layout effect after hydration, so a user who prefers dark
			 * gets one frame of light first. next-themes injects a blocking script
			 * into <head> and gets it right before the first paint.
			 */}
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
				nonce={nonce}
			>
				{/* Drives react-aria's date, number and collation formatting. */}
				<I18nProvider locale={locale}>
					{/*
					 * Without this, `href` on a HeroUI Button/Link is a plain <a> and
					 * every click is a full page load. next-intl's router is used rather
					 * than Next's so the locale prefix is applied.
					 */}
					{/*
					 * No SWRConfig: it existed only to install a global URL fetcher, and
					 * nothing fetches by URL any more — SWR consumers pass a Server Action
					 * as their fetcher (see features/notes/components/NoteList.tsx). A
					 * global URL fetcher left in place would quietly sanction
					 * `useSWR('/api/...')`, which is the path this template steered away
					 * from. Add SWRConfig back if you need genuinely global SWR options.
					 */}
					<RouterProvider navigate={(href) => router.push(href)}>
						<Toast.Provider placement="bottom end" />
						{children}
					</RouterProvider>
				</I18nProvider>
			</ThemeProvider>
		</SessionProvider>
	)
}
