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
		await expect(
			page.getByRole('heading', { name: '手机号登录' }),
		).toBeVisible()
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

	test('a wrong code keeps you on the form with an error', async ({ page }) => {
		await page.goto('/login')
		await page.getByLabel('手机号').fill('13800000000')
		await page.getByLabel('验证码', { exact: true }).fill('000000')
		await page.getByRole('button', { name: '登录', exact: true }).click()

		await expect(page.getByText('验证码不正确。')).toBeVisible()
		await expect(page).toHaveURL(/\/login$/)
	})

	test('client-side validation rejects a malformed phone number', async ({
		page,
	}) => {
		await page.goto('/login')
		await page.getByLabel('手机号').fill('123')
		await page.getByLabel('验证码', { exact: true }).fill('123456')
		await page.getByRole('button', { name: '登录', exact: true }).click()

		await expect(page.getByLabel('手机号')).toHaveAttribute(
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

test('signing out asks for confirmation first', async ({ page }) => {
	await page.goto('/dashboard')
	const railSignOut = page
		.getByRole('navigation')
		.getByRole('button', { name: '退出登录' })

	// Cancelling has to leave the session alone — a confirm dialog that signs you
	// out anyway is worse than no dialog.
	await railSignOut.click()
	const dialog = page.getByRole('alertdialog')
	await expect(dialog).toBeVisible()
	await dialog.getByRole('button', { name: '取消' }).click()
	await expect(dialog).toBeHidden()
	await expect(page).toHaveURL(/\/dashboard$/)

	// Confirming does.
	await railSignOut.click()
	await page
		.getByRole('alertdialog')
		.getByRole('button', { name: '确认退出' })
		.click()
	await expect(page).toHaveURL(/\/login$/)
})
