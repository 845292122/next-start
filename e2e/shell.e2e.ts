import { expect, test } from '@playwright/test'

test('lands on the dashboard and navigates through the rail', async ({
	page,
}) => {
	await page.goto('/')
	await expect(page).toHaveURL(/\/dashboard$/)
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()

	await page.getByRole('link', { name: '设置' }).click()
	await expect(page).toHaveURL(/\/settings$/)
	await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
})

test('renders the 404 page for unknown addresses', async ({ page }) => {
	await page.goto('/does-not-exist')
	await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
	await expect(page.getByRole('link', { name: '回到首页' })).toBeVisible()
})

test('the light/dark toggle flips the theme and survives a reload', async ({
	page,
}) => {
	await page.goto('/dashboard')
	const html = page.locator('html')

	// next-themes writes the resolved scheme as a class on <html>, which is what
	// HeroUI's variable blocks key off.
	await expect(html).toHaveClass(/light|dark/)
	const before = (await html.getAttribute('class')) ?? ''

	await page.getByRole('button', { name: /切换到(深色|浅色)模式/ }).click()
	await expect(html).not.toHaveClass(new RegExp(`^${before}$`))
	const after = (await html.getAttribute('class')) ?? ''

	// The blocking script next-themes injects is what makes this survive without
	// a flash of the previous scheme.
	await page.reload()
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()
	await expect(html).toHaveClass(new RegExp(after))
})
