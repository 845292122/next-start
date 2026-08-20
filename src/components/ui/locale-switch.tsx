'use client'

/**
 * Language picker for the rail.
 *
 * There's no context or provider here — the active locale comes from
 * NextIntlClientProvider (set up in app/[locale]/layout.tsx), so the whole thing
 * is one component.
 */

import { Button, Dropdown, Tooltip } from '@heroui/react'
import { Check, Languages } from 'lucide-react'
import { type Locale, useLocale, useTranslations } from 'next-intl'
import { getPathname, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * A full page load rather than router.replace(): this is the only navigation in
 * the app that crosses the [locale] segment, and a client-side render of that
 * segment re-renders app/[locale]/layout.tsx — which owns <html> and the <head>
 * containing the theme script next-themes injects. React refuses to run a
 * <script> it creates on the client and logs "Encountered a script tag while
 * rendering React component" (dev only, but the script really is skipped), which
 * would leave the color mode unset until the next hard load.
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

	return (
		<Dropdown>
			{/*
			 * The rail is 88px wide, so a menu rather than a segmented control.
			 *
			 * A styled Button, not Dropdown.Trigger: that component wraps the *raw*
			 * react-aria Button and takes no variant/isIconOnly. HeroUI's Button is
			 * built on the same primitive, so Dropdown still finds it through
			 * context — and it comes with the ghost icon styling.
			 */}
			<Tooltip delay={300}>
				<Button variant="ghost" isIconOnly aria-label={t('switchLanguage')}>
					<Languages className="size-4.5" />
				</Button>
				<Tooltip.Content placement="right">
					{t('switchLanguage')}
				</Tooltip.Content>
			</Tooltip>
			<Dropdown.Popover placement="right bottom">
				<Dropdown.Menu
					onAction={(key) => switchTo(pathname, key as Locale)}
					aria-label={t('label')}
				>
					{routing.locales.map((option) => (
						<Dropdown.Item key={option} id={option} textValue={t(option)}>
							{t(option)}
							{option === locale && <Check className="ml-auto size-3.5" />}
						</Dropdown.Item>
					))}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	)
}
