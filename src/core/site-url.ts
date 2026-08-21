import { env } from '@/core/env'
import { routing } from '@/i18n/routing'

/**
 * Absolute public URLs, in one place so metadata, the sitemap and robots.txt
 * can't disagree about what this site is called.
 *
 * All of it derives from `APP_URL` — see `core/env.ts` on why that has to be
 * configured rather than read off a request.
 */

/** `APP_URL` without a trailing slash, so joining paths is unambiguous. */
export const siteUrl = env.APP_URL.replace(/\/+$/, '')

/**
 * The path a locale serves a route under.
 *
 * `localePrefix` is `as-needed` (see `i18n/routing.ts`), so the default locale
 * carries **no** prefix and every other locale does. Getting this wrong in
 * metadata is the kind of mistake that doesn't break anything visibly — it just
 * publishes hreflang and sitemap URLs that redirect, which is exactly what those
 * files exist to avoid.
 */
export function localePath(locale: string, path = '/') {
	const normalized = path === '/' ? '' : `/${path.replace(/^\/+/, '')}`
	return locale === routing.defaultLocale
		? normalized || '/'
		: `/${locale}${normalized}`
}

/** Absolute URL for a route in a locale. */
export function localeUrl(locale: string, path = '/') {
	return `${siteUrl}${localePath(locale, path)}`
}

/**
 * `alternates` for a route, in the shape Next's Metadata expects.
 *
 * `canonical` is the URL for the locale being rendered; `languages` lists every
 * locale including that one, plus `x-default` pointing at the default locale.
 *
 * **A bilingual site without hreflang is a real ranking problem**, not a nicety:
 * search engines otherwise treat the two locales as duplicate content and pick
 * one themselves. `x-default` is what tells them which to serve a visitor whose
 * language matches neither.
 */
export function localeAlternates(locale: string, path = '/') {
	const languages: Record<string, string> = {}
	for (const supported of routing.locales) {
		languages[supported] = localeUrl(supported, path)
	}
	languages['x-default'] = localeUrl(routing.defaultLocale, path)

	return { canonical: localeUrl(locale, path), languages }
}
