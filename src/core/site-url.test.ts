import { describe, expect, test } from 'bun:test'
import { absoluteUrl, siteUrl } from '@/core/site-url'

describe('siteUrl', () => {
	test('has no trailing slash, so joining is unambiguous', () => {
		// A trailing slash here would produce `https://host//notes`.
		expect(siteUrl.endsWith('/')).toBe(false)
	})

	test('is absolute', () => {
		expect(siteUrl).toMatch(/^https?:\/\//)
	})
})

describe('absoluteUrl', () => {
	test('the root path has a trailing slash', () => {
		// `/` and `` are different URLs to a crawler.
		expect(absoluteUrl('/')).toBe(`${siteUrl}/`)
	})

	test('any other path has none', () => {
		expect(absoluteUrl('/notes')).toBe(`${siteUrl}/notes`)
	})

	test('tolerates a path given with or without its leading slash', () => {
		expect(absoluteUrl('notes')).toBe(`${siteUrl}/notes`)
		expect(absoluteUrl('/notes')).toBe(`${siteUrl}/notes`)
	})
})
