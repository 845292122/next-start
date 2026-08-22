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
	const scheme = () => html.getAttribute('data-mantine-color-scheme')

	// Mantine writes the resolved scheme to `data-mantine-color-scheme` on <html>,
	// and every component's styles key off that attribute.
	await expect(html).toHaveAttribute('data-mantine-color-scheme', /light|dark/)
	const before = await scheme()

	await page.getByRole('button', { name: /切换到(深色|浅色)模式/ }).click()
	await expect.poll(scheme).not.toBe(before)
	const after = await scheme()

	// The blocking <ColorSchemeScript> in the document head is what makes this
	// survive a reload without a flash of the previous scheme.
	await page.reload()
	await expect(
		page.getByRole('heading', { name: '设计系统一览' }),
	).toBeVisible()
	await expect(html).toHaveAttribute('data-mantine-color-scheme', after ?? '')
})
