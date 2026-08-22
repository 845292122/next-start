'use client'

import { Button, type ButtonProps } from '@mantine/core'
import { Link } from '@/i18n/navigation'

/**
 * A Mantine `Button` that is really a locale-aware `next-intl` link.
 *
 * Mantine's Button is polymorphic (`component={Link}`), so no class-name escape
 * hatch is needed to make a link look like a button. This exists as its own
 * component for one specific reason: **`component={Link}` cannot be written in a
 * Server Component.** In an RSC context `next-intl`'s `Link` resolves to a
 * *server* component, and passing a server function as a prop to a Client
 * Component (which every Mantine component is) fails with "Functions cannot be
 * passed directly to Client Components".
 *
 * Marking this file `'use client'` moves the whole expression to the client, where
 * `Link` resolves to the client build and is an ordinary prop. That's what lets
 * the 403 and 404 pages — both Server Components — keep prefetching and locale
 * prefixing on their way-out button.
 */
export function ButtonLink({
	href,
	replace,
	children,
	...props
}: {
	href: string
	replace?: boolean
	children: React.ReactNode
} & ButtonProps) {
	return (
		<Button component={Link} href={href} replace={replace} {...props}>
			{children}
		</Button>
	)
}
