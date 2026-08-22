import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { AppProviders } from '@/components/providers/AppProviders'
import { auth } from '@/core/auth'
import { siteUrl } from '@/core/site-url'
/*
 * Stylesheet order is load-bearing, which is why these are four JS imports here
 * rather than `@import` lines inside globals.css:
 *
 *  1. `@mantine/core/styles.css` — the reset, the `--mantine-*` variables and
 *     every component's styles.
 *  2. `@mantine/notifications/styles.css` — **must** come after core, or the
 *     notification stack loses its positioning and piles up in the corner.
 *  3. `mantine-overrides.css` — the theme's per-component overrides; must come
 *     after both of the above so it can override Mantine's own class rules.
 *  4. `globals.css` — this app's own document-level CSS, last so it wins.
 *
 * Bundlers preserve the order of CSS imports within a module, so this reads the
 * way it executes.
 */
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@/components/providers/mantine-overrides.css'
import '@/app/globals.css'

/**
 * This is the root layout — src/app/api/ is route handlers only, which don't
 * need a layout.
 */
export const metadata: Metadata = {
	// Without metadataBase every relative URL in metadata (Open Graph images
	// above all) resolves against localhost, silently, and social scrapers get a
	// dead link. See core/site-url.ts.
	metadataBase: new URL(siteUrl),
	title: 'Next Start',
	description: '全栈 Next.js 项目模板',
	alternates: { canonical: siteUrl },
	openGraph: {
		type: 'website',
		url: siteUrl,
		title: 'Next Start',
		description: '全栈 Next.js 项目模板',
	},
}

export const viewport = {
	viewportFit: 'cover' as const,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
	const session = await auth()

	// `ColorSchemeScript` below is a blocking inline <script>, which a nonce-based
	// CSP blocks unless it carries the nonce. Next attaches the nonce to its *own*
	// scripts automatically but knows nothing about this one, so it's forwarded by
	// hand. Get this wrong and the symptom is precisely what the script is here to
	// prevent: a frame of the light scheme before hydration. See src/proxy.ts.
	const nonce = (await headers()).get('x-nonce') ?? undefined

	return (
		/*
		 * mantineHtmlProps is `{ suppressHydrationWarning: true,
		 * 'data-mantine-color-scheme': 'light' }`. Both halves matter:
		 *
		 * - the attribute is what every Mantine component's styles key off, and
		 *   having it in the server markup means the page is styled before any JS
		 *   runs (a visitor with JS disabled gets the light scheme rather than an
		 *   unstyled one);
		 * - suppressHydrationWarning is required *because* of that static 'light':
		 *   ColorSchemeScript overwrites the attribute pre-paint, so the server
		 *   markup and the DOM legitimately differ on this element.
		 */
		<html lang="zh" {...mantineHtmlProps}>
			<head>
				{/*
				 * Runs before first paint and sets data-mantine-color-scheme from
				 * localStorage, falling back to the OS preference because
				 * defaultColorScheme is "auto" — which has to match the value
				 * AppProviders gives MantineProvider.
				 */}
				<ColorSchemeScript defaultColorScheme="auto" nonce={nonce} />
			</head>
			<body>
				{/*
				 * The rail lives in app/(app)/layout.tsx, not here — the (auth)
				 * group renders full-screen without it.
				 */}
				<AppProviders session={session} nonce={nonce}>
					{children}
				</AppProviders>
			</body>
		</html>
	)
}
