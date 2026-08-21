import { expect, test as setup } from '@playwright/test'
import { STORAGE_STATE } from '../playwright.config'

/**
 * Runs once before the `desktop` project and leaves a signed-in storageState
 * behind. The (app) route group requires a session, so without this every test
 * would have to walk the sign-in form first.
 *
 * The phone is the one src/core/db/seed.ts inserts; the code is the fixed
 * demo constant in src/core/auth/schema.ts — see src/core/auth/otp.ts for why
 * there's no real SMS round trip to wait on here.
 */
setup('sign in as the demo user', async ({ page }) => {
	await page.goto('/login')

	await page.getByLabel('手机号').fill('13800000000')
	await page.getByLabel('验证码', { exact: true }).fill('123456')
	await page.getByRole('button', { name: '登录', exact: true }).click()

	// Landing on the dashboard is the proof the credentials round-tripped —
	// a rejected code re-renders /login with an error instead.
	await expect(page).toHaveURL(/\/dashboard$/)
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()

	await page.context().storageState({ path: STORAGE_STATE })
})
