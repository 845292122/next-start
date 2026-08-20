import { expect, test as setup } from '@playwright/test'
import { STORAGE_STATE } from '../playwright.config'

/**
 * Runs once before the `desktop` project and leaves a signed-in storageState
 * behind. The (app) route group requires a session, so without this every test
 * would have to walk the sign-in form first.
 *
 * The account is the one src/core/db/seed.ts inserts.
 */
setup('sign in as the demo user', async ({ page }) => {
	await page.goto('/login')

	await page.getByLabel('邮箱').fill('demo@example.com')
	await page.getByLabel('密码').fill('demo1234')
	await page.getByRole('button', { name: '继续' }).click()

	// Landing on the dashboard is the proof the credentials round-tripped —
	// a rejected password re-renders /login with an error instead.
	await expect(page).toHaveURL(/\/dashboard$/)
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()

	await page.context().storageState({ path: STORAGE_STATE })
})
