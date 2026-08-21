import type { MetadataRoute } from 'next'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'

/**
 * Served at /manifest.webmanifest — what a browser reads when the app is
 * installed to a home screen or pinned.
 *
 * `dynamic = 'force-static'` because this has no request-time inputs and Next
 * would otherwise have to render it per request. It also makes the constraint
 * below explicit rather than accidental.
 *
 * **The manifest is per origin, so it cannot be localized.** One file, one
 * `lang`, one name — there is no way to serve a different manifest per locale
 * without one manifest per URL and a `<link rel="manifest">` per page. So it's
 * built from the default locale's messages, which is why `getTranslations` is
 * given an explicit locale rather than reading the request's.
 *
 * No `icons` entry: this template ships only `favicon.ico`, and listing icon
 * sizes that don't exist makes installation fail rather than degrade. Add real
 * 192×192 and 512×512 PNGs (see Next's app-icons file conventions) and then list
 * them here.
 */
export const dynamic = 'force-static'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const t = await getTranslations({
		locale: routing.defaultLocale,
		namespace: 'Meta',
	})

	return {
		name: t('title'),
		short_name: t('title'),
		description: t('description'),
		lang: routing.defaultLocale,
		start_url: '/',
		display: 'standalone',
		// Matches the light theme's --background / --accent in globals.css. These are
		// literals because a manifest can't read CSS variables; if you retheme, update
		// them here too.
		background_color: '#f7f7f7',
		theme_color: '#000000',
	}
}
