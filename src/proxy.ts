import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

/**
 * Next 16 renamed the `middleware` file convention to `proxy` — the export name
 * changed with it, but next-intl's factory is still published under
 * `next-intl/middleware`.
 *
 * This is what resolves a request to a locale: it reads the [locale] segment,
 * falls back to the `NEXT_LOCALE` cookie and then `Accept-Language`, and
 * redirects when the URL doesn't match the resolved locale.
 */
export const proxy = createMiddleware(routing)

export const config = {
	// Everything except API routes, Next internals and files with an extension
	// (which covers /favicon.ico and anything served from /public).
	matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
