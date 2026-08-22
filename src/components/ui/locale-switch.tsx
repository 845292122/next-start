'use client'

/**
 * Language picker for the rail.
 *
 * There's no context or provider here — the active locale comes from
 * NextIntlClientProvider (set up in app/[locale]/layout.tsx), so the whole thing
 * is one component.
 */

import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconCheck, IconLanguage } from '@tabler/icons-react'
import { type Locale, useLocale, useTranslations } from 'next-intl'
import { getPathname, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * A full page load rather than router.replace(): this is the only navigation in
 * the app that crosses the [locale] segment, and a client-side render of that
 * segment re-renders app/[locale]/layout.tsx — which owns <html> and the <head>
 * containing Mantine's `<ColorSchemeScript>`. React refuses to run a <script> it
 * creates on the client and logs "Encountered a script tag while rendering React
 * component" (dev only, but the script really is skipped), which would leave the
 * colour scheme at whatever `mantineHtmlProps` statically wrote until the next
 * hard load.
 *
 * Reloading also keeps <html lang> and the server-rendered markup in agreement,
 * which a soft navigation only does for the parts below the segment that changed.
 */
function switchTo(pathname: string, locale: Locale) {
	// forcePrefix, even for the default locale: localePrefix is 'as-needed', so
	// /settings on its own is ambiguous and the proxy resolves it from the
	// NEXT_LOCALE cookie — which still says the *old* locale here, sending us
	// straight back. Asking for /zh/settings lets the proxy rewrite the cookie and
	// canonicalize the URL down to /settings itself. next-intl's own router does
	// the equivalent by writing the cookie before navigating; leaning on the proxy
	// avoids duplicating a cookie name that's configurable in routing.ts.
	const target = getPathname({ href: pathname, locale, forcePrefix: true })
	// usePathname() drops the query and hash, so carry them over by hand.
	const { search, hash } = window.location
	window.location.assign(target + search + hash)
}

export function LocaleSwitchButton() {
	const t = useTranslations('Locale')
	const locale = useLocale()
	// Without the locale prefix — getPathname() adds the one for the target locale.
	const pathname = usePathname()

	// The rail is 88px wide, so a menu rather than a segmented control.
	return (
		/*
		 * withInitialFocusPlaceholder={false} — by default Mantine puts a
		 * `<div role="presentation" data-autofocus>` as the first child of the
		 * dropdown so that focus lands on nothing in particular when it opens. A
		 * `role="menu"` may only contain menu-ish roles, so axe reports it as a
		 * *critical* `aria-required-children` violation (`e2e/a11y.e2e.ts` opens this
		 * very menu). Turning it off removes the element; the cost is that focus
		 * starts on the first item instead, which is ordinary menu behaviour.
		 */
		<Menu position="right-end" withinPortal withInitialFocusPlaceholder={false}>
			{/*
			 * Tooltip *outside* Menu.Target, which is the nesting that works: the
			 * tooltip clones its ref and hover handlers onto Menu.Target, which passes
			 * anything it doesn't recognise straight down to the button. The other way
			 * round (Tooltip inside Menu.Target) silently swallows the menu's
			 * `aria-expanded` / `aria-haspopup` / `aria-controls` — Tooltip spreads
			 * unknown props onto the floating label element, not onto its child, so
			 * they end up on the tooltip instead of on the trigger.
			 */}
			<Tooltip label={t('switchLanguage')} position="right" openDelay={300}>
				<Menu.Target>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="lg"
						aria-label={t('switchLanguage')}
					>
						<IconLanguage size={18} />
					</ActionIcon>
				</Menu.Target>
			</Tooltip>

			<Menu.Dropdown aria-label={t('label')}>
				{routing.locales.map((option) => (
					<Menu.Item
						key={option}
						onClick={() => switchTo(pathname, option)}
						// A tick on the active entry rather than a checked state: these
						// navigate, so they're menu items, not radios.
						rightSection={
							option === locale ? <IconCheck size={14} /> : undefined
						}
					>
						{t(option)}
					</Menu.Item>
				))}
			</Menu.Dropdown>
		</Menu>
	)
}
