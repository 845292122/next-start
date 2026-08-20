import { expect, test } from '@playwright/test'

/**
 * localePrefix is 'as-needed', so zh (the default locale) is served without a
 * prefix and en lives under /en. The browser locale is pinned to zh-CN in
 * playwright.config.ts, so anything unprefixed resolves to Chinese here.
 */

test('serves the default locale without a prefix', async ({ page }) => {
	await page.goto('/dashboard')
	await expect(page).toHaveURL(/\/dashboard$/)
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh')
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()
})

test('redirects the default locale prefix away', async ({ page }) => {
	// /zh/... is canonicalized to /... under as-needed.
	await page.goto('/zh/dashboard')
	await expect(page).toHaveURL(/\/dashboard$/)
	await expect(page).not.toHaveURL(/\/zh\//)
})

test('serves English under the /en prefix', async ({ page }) => {
	await page.goto('/en/dashboard')
	await expect(page.locator('html')).toHaveAttribute('lang', 'en')
	await expect(
		page.getByRole('heading', { name: 'Design system at a glance' }),
	).toBeVisible()
	// The rail is translated too, not just the page body.
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
})

test('switches locale from the rail and keeps the current page', async ({
	page,
}) => {
	await page.goto('/settings')
	await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()

	await page.getByRole('button', { name: '切换语言' }).click()
	await page.getByRole('menuitem', { name: 'English' }).click()

	// Same route, prefixed — not a bounce back to the dashboard.
	await expect(page).toHaveURL('/en/settings')
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

	// And back, which drops the prefix again. The exact URL matters: a regex like
	// /\/settings$/ also matches /en/settings, which is precisely the failure mode
	// here — the NEXT_LOCALE cookie still saying "en" and the proxy bouncing the
	// unprefixed URL back. locale-switch.tsx navigates with forcePrefix so the
	// proxy rewrites the cookie and canonicalizes.
	// Retried: switching locale is a full page load, so the rail is painted from
	// SSR markup before React has hydrated and the first click on the menu can
	// land on a button that isn't listening yet.
	await expect(async () => {
		await page.getByRole('button', { name: 'Switch language' }).click()
		await expect(page.getByRole('menuitem', { name: '简体中文' })).toBeVisible({
			timeout: 1000,
		})
	}).toPass()
	await page.getByRole('menuitem', { name: '简体中文' }).click()
	await expect(page).toHaveURL('/settings')
	await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
})

test('carries the query and hash across a locale switch', async ({ page }) => {
	await page.goto('/settings?tab=appearance#notifications')

	await page.getByRole('button', { name: '切换语言' }).click()
	await page.getByRole('menuitem', { name: 'English' }).click()

	// usePathname() drops both, so locale-switch.tsx re-attaches them by hand.
	await expect(page).toHaveURL('/en/settings?tab=appearance#notifications')
})

test('renders the localized 404 under a locale prefix', async ({ page }) => {
	await page.goto('/en/does-not-exist')
	await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible()
})
