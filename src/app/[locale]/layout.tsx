import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AppProviders } from '@/components/providers/AppProviders'
import { auth } from '@/core/auth'
import { routing } from '@/i18n/routing'
import '@/app/globals.css'

/**
 * This is the root layout — there is no src/app/layout.tsx. Everything that
 * renders HTML lives under [locale]; src/app/api/ is route handlers only, which
 * don't need a layout.
 */
export async function generateMetadata({
	params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
	// generateMetadata runs independently of the layout below, so the same
	// untrusted-locale guard is needed here. Falling back rather than calling
	// notFound() — the layout is what owns the 404.
	const { locale } = await params
	const t = await getTranslations({
		locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
		namespace: 'Meta',
	})

	return {
		title: t('title'),
		description: t('description'),
	}
}

export const viewport = {
	viewportFit: 'cover' as const,
}

export default async function RootLayout({
	children,
	params,
}: LayoutProps<'/[locale]'>) {
	// params.locale is untrusted — /xx/dashboard would land here with "xx".
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) notFound()

	// Opts this segment into static rendering where possible; without it,
	// anything reading the locale forces a dynamic render.
	setRequestLocale(locale)

	const session = await auth()

	return (
		// suppressHydrationWarning is required by next-themes: its blocking script
		// writes class="light|dark" on this element before React hydrates, so the
		// server markup and the DOM legitimately differ here.
		<html lang={locale} suppressHydrationWarning>
			<body className="bg-background text-foreground">
				{/*
				 * No props needed: rendered from a Server Component,
				 * NextIntlClientProvider resolves locale, messages, formats and time
				 * zone from the request config itself.
				 */}
				<NextIntlClientProvider>
					{/*
					 * The rail lives in app/[locale]/(app)/layout.tsx, not here — the
					 * (auth) group renders full-screen without it.
					 */}
					<AppProviders session={session}>{children}</AppProviders>
				</NextIntlClientProvider>
			</body>
		</html>
	)
}
