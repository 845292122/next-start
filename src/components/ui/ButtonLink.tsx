'use client'

import { Button, type ButtonProps } from '@mantine/core'
import Link from 'next/link'

/**
 * A Mantine `Button` that is really a `next/link`.
 *
 * Mantine's Button is polymorphic (`component={Link}`), so no class-name escape
 * hatch is needed to make a link look like a button. This exists as its own
 * component for one specific reason: **`component={Link}` cannot be written in a
 * Server Component.** This isn't about which `Link` — `next/link`'s is itself a
 * Client Component — it's that passing a component *reference* as a plain prop
 * value (rather than using it as JSX) hands React a bare function, and RSC can't
 * serialize a function across the server/client boundary unless it's a Server
 * Action: "Functions cannot be passed directly to Client Components." Confirmed
 * empirically — swapping this back for a direct `<Button component={Link}>` in
 * `(app)/403/page.tsx` reproduces the error.
 *
 * Marking this file `'use client'` moves the whole expression to the client,
 * where passing `Link` as a prop is just an ordinary function reference, not a
 * serialization boundary. That's what lets the 403 and 404 pages — both Server
 * Components — keep prefetching on their way-out button.
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
