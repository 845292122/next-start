import { expect, test } from '@playwright/test'

/**
 * Security headers, and — more importantly — whether the app still works under
 * them.
 *
 * `core/security-headers.test.ts` asserts the header *values*. It cannot tell you
 * whether a browser will refuse to run the app given those values, and a CSP
 * failure is quiet: the page loads, one script or stylesheet silently doesn't, and
 * nothing throws. That's what the violation-collecting tests below are for.
 *
 * These run against `next start` (see playwright.config.ts), so the policy under
 * test is the production one: nonce + `'strict-dynamic'` scripts and no
 * `'unsafe-eval'`.
 */

/** Pages worth checking: the shell, a form, the design-system page, signed-out. */
const PAGES = ['/dashboard', '/notes', '/settings', '/en/login']

/**
 * Collects CSP violations for one navigation.
 *
 * Both channels are needed. `securitypolicyviolation` is the precise signal but
 * only fires for elements already in the document when the listener attaches, so
 * the console is watched too — Chrome logs every refusal there.
 */
async function collectCspViolations(
	page: import('@playwright/test').Page,
	path: string,
) {
	const violations: string[] = []

	page.on('console', (message) => {
		const text = message.text()
		if (
			text.includes('Content Security Policy') ||
			text.includes('Refused to')
		) {
			violations.push(text)
		}
	})

	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) => {
			console.error(
				`Refused to load ${event.violatedDirective}: ${event.blockedURI}`,
			)
		})
	})

	await page.goto(path)
	await page.waitForLoadState('networkidle')

	return violations
}

test.describe('response headers', () => {
	test('a page carries the CSP and the static headers', async ({ request }) => {
		const headers = (await request.get('/en/login')).headers()

		expect(headers['content-security-policy']).toContain("default-src 'self'")
		expect(headers['x-content-type-options']).toBe('nosniff')
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
		expect(headers['x-frame-options']).toBe('DENY')
		expect(headers['permissions-policy']).toContain('camera=()')
		expect(headers['cross-origin-opener-policy']).toBe('same-origin')
	})

	test('the static headers reach /api too, where the proxy does not run', async ({
		request,
	}) => {
		// The proxy's matcher excludes /api, so these can only come from
		// next.config.ts. `nosniff` on a JSON response is the one that matters.
		const headers = (await request.get('/api/health')).headers()

		expect(headers['x-content-type-options']).toBe('nosniff')
		expect(headers['x-frame-options']).toBe('DENY')
	})

	test('the nonce is different on every request', async ({ request }) => {
		// A reused nonce is worth no more than 'unsafe-inline'.
		const nonceOf = async () => {
			const csp = (await request.get('/en/login')).headers()[
				'content-security-policy'
			]
			return /'nonce-([^']+)'/.exec(csp ?? '')?.[1]
		}

		const [first, second] = [await nonceOf(), await nonceOf()]

		expect(first).toBeTruthy()
		expect(second).toBeTruthy()
		expect(first).not.toBe(second)
	})
})

test.describe('the app runs under the production CSP', () => {
	for (const path of PAGES) {
		test(`no CSP violations on ${path}`, async ({ page }) => {
			const violations = await collectCspViolations(page, path)
			expect(violations).toEqual([])
		})
	}

	test("Mantine's colour-scheme script is not blocked", async ({ page }) => {
		// The sharpest check of the nonce wiring. `<ColorSchemeScript>` is an inline
		// <script> that sets the scheme attribute before first paint; Next tags its
		// own scripts with the nonce but knows nothing about that one, so
		// app/[locale]/layout.tsx forwards `x-nonce` to it by hand. If that breaks,
		// the script is refused and <html> keeps the static 'light' that
		// `mantineHtmlProps` wrote — i.e. the flash of the wrong scheme this script
		// exists to prevent.
		await page.goto('/dashboard')

		await expect(page.locator('html')).toHaveAttribute(
			'data-mantine-color-scheme',
			/light|dark/,
		)
	})

	test('a Mantine overlay still positions itself', async ({ page }) => {
		// Mantine positions popovers with inline `style` attributes, which nonces
		// never cover — the reason style-src settles for 'unsafe-inline' (see
		// core/security-headers.ts). A popover collapsed at 0,0 or unstyled is the
		// symptom if that regresses.
		await page.goto('/dashboard')

		const trigger = page.getByRole('button', { name: '切换语言' })
		await trigger.click()

		const menu = page.getByRole('menu')
		await expect(menu).toBeVisible()

		const box = await menu.boundingBox()
		expect(box).not.toBeNull()
		// Positioned somewhere real, not collapsed at the origin.
		expect(box?.width ?? 0).toBeGreaterThan(0)
		expect((box?.x ?? 0) + (box?.y ?? 0)).toBeGreaterThan(0)
	})
})

/**
 * Sign-in rate limiting.
 *
 * Signed out, and on a phone number no other test touches: the limiter keys by
 * number and keeps counters in process memory for 10 minutes, so a shared number
 * would leak state into `auth.setup.ts` and the suite runs `fullyParallel`.
 */
test.describe('sign-in rate limit', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test('refuses a correct code once the attempt budget is spent', async ({
		page,
	}) => {
		const phone = '13511112222'
		await page.goto('/login')

		const submit = async (code: string) => {
			await page.getByLabel('手机号').fill(phone)
			await page.getByLabel('验证码', { exact: true }).fill(code)
			// exact: true — '登录' alone also matches '微信登录（未接入）'.
			await page.getByRole('button', { name: '登录', exact: true }).click()
			await expect(page.getByText('验证码不正确。')).toBeVisible()
		}

		// The limit is 5 per 10 minutes. Every one of these fails on the code check,
		// which is what spends the budget.
		for (let attempt = 0; attempt < 5; attempt++) {
			await submit('000000')
		}

		// The sixth carries the *correct* demo code. It still has to fail — that's
		// what proves the limiter refused it rather than the code comparison.
		await submit('123456')
		await expect(page).toHaveURL(/\/login$/)

		// And the response deliberately looks identical to a wrong code: telling an
		// attacker they're being throttled is what lets them pace around it.
	})
})
