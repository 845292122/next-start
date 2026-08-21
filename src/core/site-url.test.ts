import { describe, expect, test } from 'bun:test'
import {
	localeAlternates,
	localePath,
	localeUrl,
	siteUrl,
} from '@/core/site-url'
import { routing } from '@/i18n/routing'

/**
 * The `as-needed` locale-prefix logic, which is where the SEO bugs live.
 *
 * Every mistake in here is silent: a wrong prefix publishes a canonical or
 * hreflang that redirects, and nothing complains until a crawler does. Pure
 * functions, so they're cheap to pin down exactly.
 */

describe('localePath', () => {
	test('the default locale carries no prefix', () => {
		// localePrefix is 'as-needed' (i18n/routing.ts), so /dashboard is Chinese and
		// /zh/dashboard redirects to it. Emitting the prefixed form in metadata would
		// publish a URL that 307s.
		expect(localePath('zh', '/')).toBe('/')
		expect(localePath('zh', '/notes')).toBe('/notes')
	})

	test('every other locale does carry one', () => {
		expect(localePath('en', '/')).toBe('/en')
		expect(localePath('en', '/notes')).toBe('/en/notes')
	})

	test('the root path has no trailing slash except at the root itself', () => {
		// `/en/` and `/en` are different URLs to a crawler.
		expect(localePath('en', '/')).toBe('/en')
		expect(localePath('zh', '/')).toBe('/')
	})

	test('tolerates a path given with or without its leading slash', () => {
		expect(localePath('en', 'notes')).toBe('/en/notes')
		expect(localePath('en', '/notes')).toBe('/en/notes')
	})
})

describe('siteUrl', () => {
	test('has no trailing slash, so joining is unambiguous', () => {
		// A trailing slash here would produce `https://host//notes`.
		expect(siteUrl.endsWith('/')).toBe(false)
	})

	test('is absolute', () => {
		expect(siteUrl).toMatch(/^https?:\/\//)
	})
})

describe('localeUrl', () => {
	test('is absolute and locale-correct', () => {
		expect(localeUrl('zh', '/notes')).toBe(`${siteUrl}/notes`)
		expect(localeUrl('en', '/notes')).toBe(`${siteUrl}/en/notes`)
	})
})

describe('localeAlternates', () => {
	test('canonical is the URL of the locale being rendered', () => {
		expect(localeAlternates('en', '/notes').canonical).toBe(
			`${siteUrl}/en/notes`,
		)
		expect(localeAlternates('zh', '/notes').canonical).toBe(`${siteUrl}/notes`)
	})

	test('languages lists every locale plus x-default', () => {
		const { languages } = localeAlternates('en')

		expect(Object.keys(languages).sort()).toEqual(
			[...routing.locales, 'x-default'].sort(),
		)
	})

	test('the set is identical whichever locale is rendering', () => {
		// hreflang has to be reciprocal — each locale must advertise all of them, or
		// search engines discard the whole group.
		expect(localeAlternates('en', '/notes').languages).toEqual(
			localeAlternates('zh', '/notes').languages,
		)
	})

	test('x-default points at the default locale', () => {
		const { languages } = localeAlternates('en')

		expect(languages['x-default']).toBe(languages[routing.defaultLocale])
	})

	test('every value is absolute', () => {
		for (const url of Object.values(
			localeAlternates('zh', '/notes').languages,
		)) {
			expect(url).toMatch(/^https?:\/\//)
		}
	})
})
