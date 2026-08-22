import { expect, test } from '@playwright/test'

/**
 * Covers the whole vertical slice: the Server Action that creates a note, the
 * SWR list that reads it back through /api/notes, and the route handlers behind
 * toggle and delete.
 *
 * Every test makes its own note with a unique title, because the suite runs
 * fullyParallel against one shared database.
 *
 * **And every test that asserts its note is visible filters the list down to that
 * title first.** The list is paginated (20 rows), so any test that creates a lot of
 * notes — `the load-more button widens the page` creates 22 — can push another
 * test's note off page one *while that test is running*. Searching makes each
 * assertion independent of how much else exists.
 */
function uniqueTitle(label: string) {
	return `${label}-${test.info().testId}`
}

test('shows the seeded notes', async ({ page }) => {
	await page.goto('/notes')
	await expect(page.getByRole('heading', { name: '笔记' })).toBeVisible()

	// Found via search rather than expected on the first page. The list is
	// paginated now (20 rows) and the seeded notes are the *oldest*, so any test
	// that adds enough notes would push them off page one — asserting on page one
	// would make this fail depending on execution order and volume.
	await page.getByRole('searchbox').fill('Welcome')
	await expect(page.getByText('Welcome', { exact: true })).toBeVisible()
})

test('creates a note through the server action', async ({ page }) => {
	const title = uniqueTitle('E2E 新建')
	await page.goto('/notes')

	await page.getByLabel('标题').fill(title)
	await page.getByLabel('内容').fill('由 Playwright 创建')
	await page.getByRole('button', { name: '添加' }).click()

	// Filtered, so a concurrent test's bulk insert can't push this off page one.
	await page.getByRole('searchbox').fill(title)
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

	// Filtered before every assertion below, including after each reload: without
	// this, a concurrent bulk insert pushes this note off page one and the
	// toBeChecked() assertions fail for a reason that has nothing to do with
	// toggling.
	const focusList = async () => {
		await page.getByRole('searchbox').fill(title)
	}
	await focusList()

	const row = page.locator('li').filter({ hasText: title })
	await expect(row).toBeVisible()

	// The same element is clicked and asserted on: Mantine's Checkbox styles a real
	// <input type="checkbox"> instead of hiding it behind a decorative proxy, and
	// its check icon is `pointer-events: none`, so nothing intercepts the click.
	const checkbox = row.getByRole('checkbox')

	await expect(checkbox).not.toBeChecked()
	await checkbox.click()
	await expect(checkbox).toBeChecked()

	// A reload proves the toggle persisted rather than only flipping the
	// optimistic SWR cache.
	await page.reload()
	await focusList()
	const rowAfter = page.locator('li').filter({ hasText: title })
	await expect(rowAfter.getByRole('checkbox')).toBeChecked()

	await rowAfter.getByRole('button', { name: `删除「${title}」` }).click()
	await expect(page.locator('li').filter({ hasText: title })).toHaveCount(0)

	await page.reload()
	await focusList()
	await expect(page.locator('li').filter({ hasText: title })).toHaveCount(0)
})

test('the load-more button widens the page', async ({ page, request }) => {
	// Notes are created through the API rather than the form: this needs more rows
	// than the 20-row page size, and 20 form submissions would be slow and would
	// prove nothing extra.
	const tag = `LoadMore-${test.info().testId}`
	await Promise.all(
		Array.from({ length: 22 }, (_, i) =>
			request.post('/api/notes', { data: { title: `${tag}-${i}` } }),
		),
	)

	await page.goto('/notes')
	// Filter to just these, so the assertion doesn't depend on what else exists.
	await page.getByRole('searchbox').fill(tag)

	const rows = page.locator('li').filter({ hasText: tag })
	await expect(rows).toHaveCount(20)

	// The button only appears because the server reported total > items.length.
	const loadMore = page.getByRole('button', { name: /加载更多/ })
	await expect(loadMore).toBeVisible()
	await loadMore.click()

	await expect(rows).toHaveCount(22)
	// Nothing left to fetch, so the affordance goes away.
	await expect(loadMore).toBeHidden()
})
