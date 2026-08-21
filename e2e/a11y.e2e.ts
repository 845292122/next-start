import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Automated accessibility checks.
 *
 * This project is built on react-aria and is careful about roles and labels — the
 * whole test suite locates elements with `getByRole`, which only works if the
 * roles are right. That care had nothing guarding it: a regression would show up as
 * a *test* failure somewhere unrelated, or not at all.
 *
 * **What axe can and can't do.** It catches machine-checkable violations: contrast
 * ratios, missing form labels, invalid ARIA, duplicate ids, unlabelled landmarks.
 * It cannot judge whether the focus order makes sense or whether a label is
 * *meaningful*. Passing this is a floor, not a certificate — roughly a third of
 * WCAG is machine-checkable at all.
 *
 * Scoped to wcag2a/wcag2aa/wcag21a/wcag21aa rather than every axe rule:
 * "best-practice" rules are opinions worth reading but not worth failing a build
 * over, and including them would make the suite noisy enough to get disabled.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** The signed-in shell, a form-heavy page, and the design-system page. */
const SIGNED_IN_PAGES = ['/dashboard', '/notes', '/settings']

/**
 * `nested-interactive` is disabled, and this is the one exclusion — everything else
 * in WCAG A/AA is enforced.
 *
 * HeroUI's `Tooltip` wraps whatever you give it in its own focusable element:
 *
 * ```html
 * <div class="tooltip__trigger" role="button" tabindex="0">
 *   <a aria-label="概览" ...>…</a>
 * </div>
 * ```
 *
 * A focusable `role="button"` containing a focusable link is a genuine problem —
 * two tab stops, and the wrong role announced on the outer one. But it is HeroUI's
 * markup, not this app's: we render `<Tooltip><Link/><Tooltip.Content/></Tooltip>`
 * and the wrapper is added for us, with no prop to opt out. Fixing it means
 * patching HeroUI or dropping tooltips from the rail, neither of which belongs in
 * an accessibility *test*.
 *
 * It's in DEVELOPMENT.md's known-gaps list. The rail's items all carry
 * `aria-label`, so they are reachable and named; the defect is the extra tab stop.
 *
 * Disabling one rule by name — rather than skipping the affected pages — keeps
 * every other check live on exactly the pages most likely to regress.
 */
const LIBRARY_RULES_TO_SKIP = ['nested-interactive']

async function analyze(page: import('@playwright/test').Page) {
	return new AxeBuilder({ page })
		.withTags(WCAG_TAGS)
		.disableRules(LIBRARY_RULES_TO_SKIP)
		.analyze()
}

/** Compact failure output — the raw axe result is thousands of lines of DOM. */
function summarize(
	violations: Awaited<ReturnType<typeof analyze>>['violations'],
) {
	return violations.map((v) => ({
		id: v.id,
		impact: v.impact,
		help: v.help,
		nodes: v.nodes.map((n) => n.target.join(' ')),
	}))
}

for (const path of SIGNED_IN_PAGES) {
	test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
		await page.goto(path)
		// The rail animates content in; analysing mid-transition produces contrast
		// findings against a half-faded background.
		await page.waitForLoadState('networkidle')

		const { violations } = await analyze(page)

		expect(summarize(violations)).toEqual([])
	})
}

test.describe('signed out', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test('the sign-in page has no WCAG A/AA violations', async ({ page }) => {
		// The one page an unauthenticated user can reach, so the one most likely to be
		// hit by someone using a screen reader before they have an account.
		await page.goto('/login')
		await page.waitForLoadState('networkidle')

		const { violations } = await analyze(page)

		expect(summarize(violations)).toEqual([])
	})

	test('the 404 page has no WCAG A/AA violations', async ({ page }) => {
		await page.goto('/no-such-page-anywhere')
		await page.waitForLoadState('networkidle')

		const { violations } = await analyze(page)

		expect(summarize(violations)).toEqual([])
	})
})

test('an open dropdown is still accessible', async ({ page }) => {
	// Overlays are where a11y usually breaks: focus trapping, aria-expanded, and the
	// popover's own contrast against whatever it covers. A page-load scan never sees
	// any of it because the markup doesn't exist yet.
	await page.goto('/dashboard')
	await page.getByRole('button', { name: '切换语言' }).click()
	await expect(page.getByRole('menu')).toBeVisible()

	const { violations } = await analyze(page)

	expect(summarize(violations)).toEqual([])
})
