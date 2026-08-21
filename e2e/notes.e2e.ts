import { expect, test } from '@playwright/test'

/**
 * Covers the whole vertical slice: the Server Action that creates a note, the
 * SWR list that reads it back through /api/notes, and the route handlers behind
 * toggle and delete.
 *
 * Every test makes its own note with a unique title, because the suite runs
 * fullyParallel against one shared database.
 */
function uniqueTitle(label: string) {
	return `${label}-${test.info().testId}`
}

test('shows the seeded notes', async ({ page }) => {
	await page.goto('/notes')
	await expect(page.getByRole('heading', { name: '笔记' })).toBeVisible()
	await expect(page.getByText('Welcome', { exact: true })).toBeVisible()
})

test('creates a note through the server action', async ({ page }) => {
	const title = uniqueTitle('E2E 新建')
	await page.goto('/notes')

	await page.getByLabel('标题').fill(title)
	await page.getByLabel('内容').fill('由 Playwright 创建')
	await page.getByRole('button', { name: '添加' }).click()

	await expect(page.getByText(title, { exact: true })).toBeVisible()
	// The form resets so the next note doesn't inherit the last one's title.
	await expect(page.getByLabel('标题')).toHaveValue('')
})

test('search matches regardless of case', async ({ page }) => {
	const title = uniqueTitle('CaseCheck')
	await page.goto('/notes')
	await page.getByLabel('标题').fill(title)
	await page.getByRole('button', { name: '添加' }).click()
	await expect(page.getByText(title, { exact: true })).toBeVisible()

	// Guards the lower() wrapper in notes-service.listNotes.
	await page.getByRole('searchbox').fill(title.toLowerCase())
	await expect(page.getByText(title, { exact: true })).toBeVisible()

	await page.getByRole('searchbox').fill('no-such-note-anywhere')
	await expect(page.getByText('没有匹配的笔记')).toBeVisible()
})

test('a new note shows up while a search filter is active', async ({
	page,
}) => {
	// Regression guard. NoteForm used to revalidate `notesKey()` — the key for the
	// *empty* query — so creating a note with text in the search box left the
	// visible, filtered list stale until something else refetched it. The fix is
	// revalidating by key filter instead; see features/notes/swr-keys.ts.
	const tag = `FilterCheck-${test.info().testId}`
	await page.goto('/notes')

	await page.getByRole('searchbox').fill(tag)
	await expect(page.getByText('没有匹配的笔记')).toBeVisible()

	// The search box stays filled while this is submitted.
	await page.getByLabel('标题').fill(`${tag} 新建的`)
	await page.getByRole('button', { name: '添加' }).click()

	await expect(page.getByText(`${tag} 新建的`, { exact: true })).toBeVisible()
})

test('toggles and deletes a note', async ({ page }) => {
	const title = uniqueTitle('E2E 切换')
	await page.goto('/notes')
	await page.getByLabel('标题').fill(title)
	await page.getByRole('button', { name: '添加' }).click()

	const row = page.locator('li').filter({ hasText: title })
	await expect(row).toBeVisible()

	// Assertions read the real <input type="checkbox">, but the click has to land
	// on the visible control: react-aria renders the input underneath its own
	// decoration, so Playwright's actionability check reports the control span as
	// intercepting pointer events on the input itself.
	const checkbox = row.getByRole('checkbox')
	const control = row.locator('[data-slot="checkbox-content"]')

	await expect(checkbox).not.toBeChecked()
	await control.click()
	await expect(checkbox).toBeChecked()

	// A reload proves the PATCH persisted rather than only flipping the
	// optimistic SWR cache.
	await page.reload()
	const rowAfter = page.locator('li').filter({ hasText: title })
	await expect(rowAfter.getByRole('checkbox')).toBeChecked()

	await rowAfter.getByRole('button', { name: `删除「${title}」` }).click()
	await expect(page.locator('li').filter({ hasText: title })).toHaveCount(0)

	await page.reload()
	await expect(page.locator('li').filter({ hasText: title })).toHaveCount(0)
})
