import { expect, test } from '@playwright/test'

/**
 * The signed-out half of the auth story. Everything here runs without the
 * storageState the setup project saved — that's what test.use() below undoes.
 */
test.describe('signed out', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test('an anonymous visitor is bounced from the app group to /login', async ({
		page,
	}) => {
		await page.goto('/settings')
		await expect(page).toHaveURL(/\/login$/)
		await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
	})

	test('/ redirects to /login rather than the dashboard', async ({ page }) => {
		await page.goto('/')
		await expect(page).toHaveURL(/\/login$/)
	})

	test('the rail is not rendered on the sign-in page', async ({ page }) => {
		await page.goto('/login')
		await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(
			0,
		)
	})

	test('a wrong password keeps you on the form with an error', async ({
		page,
	}) => {
		await page.goto('/login')
		await page.getByLabel('邮箱').fill('demo@example.com')
		await page.getByLabel('密码').fill('wrong-password')
		await page.getByRole('button', { name: '继续' }).click()

		// Matched by text rather than by role: Next's own route announcer is also
		// role="alert", so a bare getByRole('alert') is a strict-mode violation.
		await expect(page.getByText('邮箱或密码不正确。')).toBeVisible()
		await expect(page).toHaveURL(/\/login$/)
	})

	test('client-side validation rejects a malformed email', async ({ page }) => {
		await page.goto('/login')
		await page.getByLabel('邮箱').fill('not-an-email')
		await page.getByLabel('密码').fill('demo1234')
		await page.getByRole('button', { name: '继续' }).click()

		// zod's message, surfaced through react-hook-form into HeroUI's FieldError.
		await expect(page.getByLabel('邮箱')).toHaveAttribute(
			'aria-invalid',
			'true',
		)
		await expect(page).toHaveURL(/\/login$/)
	})

	test('unauthenticated API calls are refused', async ({ request }) => {
		// Route handlers don't run layouts, so this is a separate guard from the
		// (app) layout's — worth asserting on its own.
		expect((await request.get('/api/notes')).status()).toBe(401)
	})
})

test('signing out returns to the login page', async ({ page }) => {
	await page.goto('/dashboard')

	await page.getByRole('button', { name: '账户' }).click()
	await page.getByRole('menuitem', { name: '退出登录' }).click()

	await expect(page).toHaveURL(/\/login$/)
})
