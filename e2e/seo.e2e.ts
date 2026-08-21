import { expect, test } from '@playwright/test'

/**
 * The SEO surface: canonical, hreflang, robots.txt, sitemap.xml, manifest.
 *
 * Worth testing because every failure mode here is **silent**. A missing
 * `metadataBase` doesn't throw, it just publishes localhost URLs; a wrong
 * `localePath` doesn't throw, it publishes hreflang that redirects. Nothing
 * surfaces until a crawler tells you months later.
 *
 * These run signed out — everything asserted here has to work for a crawler,
 * which has no session.
 */
test.use({ storageState: { cookies: [], origins: [] } })

/** Absolute URLs are built from APP_URL, which the e2e server leaves at its default. */
const ORIGIN = 'http://localhost:3000'

test.describe('page metadata', () => {
	test('the default locale is canonical to the unprefixed URL', async ({
		page,
	}) => {
		// localePrefix is 'as-needed', so the default locale has no prefix. Getting
		// this wrong publishes a canonical that redirects.
		await page.goto('/')

		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			ORIGIN,
		)
	})

	test('a non-default locale is canonical to its prefixed URL', async ({
		page,
	}) => {
		await page.goto('/en')

		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			`${ORIGIN}/en`,
		)
	})

	test('every locale plus x-default is declared, on both locales', async ({
		page,
	}) => {
		// hreflang has to be reciprocal: each locale must list all of them, or search
		// engines ignore the whole set. That's the mistake this catches.
		for (const path of ['/', '/en']) {
			await page.goto(path)

			const alternates = page.locator('link[rel="alternate"]')
			await expect(alternates).toHaveCount(3)

			const hreflangs = await alternates.evaluateAll((links) =>
				links.map((l) => l.getAttribute('hreflang')),
			)
			expect(new Set(hreflangs)).toEqual(new Set(['zh', 'en', 'x-default']))
		}
	})

	test('x-default points at the default locale', async ({ page }) => {
		await page.goto('/')

		await expect(
			page.locator('link[rel="alternate"][hreflang="x-default"]'),
		).toHaveAttribute('href', ORIGIN)
	})

	test('no metadata URL is relative or points at a placeholder', async ({
		page,
	}) => {
		// What a missing metadataBase actually looks like.
		await page.goto('/en')

		const hrefs = await page
			.locator('link[rel="canonical"], link[rel="alternate"]')
			.evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''))

		expect(hrefs.length).toBeGreaterThan(0)
		for (const href of hrefs) {
			expect(href).toMatch(/^https?:\/\//)
		}
	})
})

test.describe('robots.txt', () => {
	test('is served and points at the sitemap', async ({ request }) => {
		const body = await (await request.get('/robots.txt')).text()

		expect(body).toContain('User-Agent: *')
		expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
	})

	test('keeps crawlers out of the API and the sign-in page', async ({
		request,
	}) => {
		// Not access control — the session guard is that. But an indexed /login
		// attracts credential-stuffing traffic, and /api/auth/* URLs carry tokens in
		// query strings.
		const body = await (await request.get('/robots.txt')).text()

		expect(body).toContain('Disallow: /api/')
		expect(body).toContain('Disallow: /login')
	})
})

test.describe('sitemap.xml', () => {
	test('is served as a well-formed, empty urlset', async ({ request }) => {
		// Empty on purpose — see sitemap.ts. The hreflang *shape* of an entry isn't
		// asserted here because there are no entries to assert on; that logic lives in
		// `localeAlternates` and is unit tested in core/site-url.test.ts.
		const body = await (await request.get('/sitemap.xml')).text()

		expect(body).toContain('<?xml')
		expect(body).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
		expect(body).toContain('</urlset>')
	})

	test('lists no URL that needs a session', async ({ request }) => {
		// A sitemap entry that redirects to /login burns crawl budget and reports as
		// an error in Search Console — worse than omitting it.
		const body = await (await request.get('/sitemap.xml')).text()

		for (const path of [
			'/dashboard',
			'/notes',
			'/settings',
			'/login',
			'/403',
		]) {
			expect(body).not.toContain(`${ORIGIN}${path}`)
		}
	})

	test('every URL it lists actually resolves without a redirect', async ({
		request,
	}) => {
		// Vacuous today — PUBLIC_PATHS is empty because this template has no publicly
		// crawlable page (see sitemap.ts). Kept deliberately: it's the guard that
		// fires the moment someone adds a path, and it already earned its place by
		// catching `/`, which is a 307 to /dashboard.
		const body = await (await request.get('/sitemap.xml')).text()
		const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

		for (const url of urls) {
			const response = await request.get(url, { maxRedirects: 0 })
			expect(response.status(), `${url} should not redirect`).toBe(200)
		}
	})
})

test.describe('manifest', () => {
	test('is served and linked from the page', async ({ page, request }) => {
		const manifest = await (await request.get('/manifest.webmanifest')).json()

		expect(manifest.name).toBeTruthy()
		expect(manifest.start_url).toBe('/')
		expect(manifest.display).toBe('standalone')
		// Listing icons that don't exist makes installation fail rather than degrade,
		// so this template lists none — asserted so adding one is deliberate.
		expect(manifest.icons).toBeUndefined()

		await page.goto('/')
		await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
	})
})
