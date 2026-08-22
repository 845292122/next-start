import { env } from '@/core/env'

/**
 * Absolute public URLs, in one place so metadata, the sitemap and robots.txt
 * can't disagree about what this site is called.
 *
 * All of it derives from `APP_URL` — see `core/env.ts` on why that has to be
 * configured rather than read off a request.
 */

/** `APP_URL` without a trailing slash, so joining paths is unambiguous. */
export const siteUrl = env.APP_URL.replace(/\/+$/, '')

/** Absolute URL for a route. */
export function absoluteUrl(path = '/') {
	const normalized = path === '/' ? '' : `/${path.replace(/^\/+/, '')}`
	return `${siteUrl}${normalized || '/'}`
}
