'use client'

import { ActionIcon, Box, Flex, Progress, Stack, Tooltip } from '@mantine/core'
import type { Icon } from '@phosphor-icons/react'
// useLinkStatus still comes from next/link — the Link below wraps it, so the
// hook reads the same context.
import { useLinkStatus } from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { navLinks } from '@/components/layout/NavLinks'
import { BlackHoleMark } from '@/components/ui/BlackHoleMark'
import { ColorModeButton } from '@/components/ui/color-mode'
import { LocaleSwitchButton } from '@/components/ui/locale-switch'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { Link, usePathname } from '@/i18n/navigation'
import classes from './AppShell.module.css'

const RAIL_WIDTH = 88

/**
 * Reports its <Link> parent's pending state upwards so the content area can show
 * a loading bar. Prefetched routes navigate instantly and never go pending, so in
 * practice the bar only appears when navigation really blocks.
 */
function LinkPending({ onPending }: { onPending: (delta: number) => void }) {
	const { pending } = useLinkStatus()

	useEffect(() => {
		if (!pending) return
		onPending(1)
		return () => onPending(-1)
	}, [pending, onPending])

	return null
}

/**
 * One rounded square per route, icon only.
 *
 * An `ActionIcon` rendered `component={Link}`: it has to stay a next/link to keep
 * prefetching and `useLinkStatus`, and ActionIcon's polymorphic `component` prop
 * gives it the icon-button styling without wrapping it in anything. `size="xl"` is
 * 44px, matching the rail's other controls.
 *
 * Unlike the react-aria tooltip this replaces, Mantine's clones the ref onto the
 * child rather than wrapping it in another focusable element — so the tooltip
 * opens on keyboard focus as well as hover, and the rail has one tab stop per
 * item instead of two. `aria-label` still carries the accessible name (Tooltip
 * only contributes `aria-describedby`), which is what the rail's e2e assertions
 * match on.
 */
function NavItem({
	label,
	icon: NavIcon,
	href,
	active,
	onPending,
}: {
	label: string
	icon: Icon
	href: string
	active: boolean
	onPending: (delta: number) => void
}) {
	return (
		<Tooltip label={label} position="right" openDelay={300}>
			<ActionIcon
				component={Link}
				href={href}
				aria-label={label}
				size="xl"
				// filled/light rather than a colour swap: `light` is a tinted square
				// that reads as an inactive affordance, `filled` is the solid primary
				// one. Both are theme-driven, so neither needs a dark-mode variant.
				variant={active ? 'filled' : 'light'}
				color={active ? undefined : 'gray'}
			>
				<NavIcon size={20} />
				<LinkPending onPending={onPending} />
			</ActionIcon>
		</Tooltip>
	)
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const t = useTranslations('Nav')
	// next-intl's usePathname() strips the locale prefix, so comparing against
	// navLinks' hrefs works unchanged.
	const pathname = usePathname()
	const [pendingCount, setPendingCount] = useState(0)

	// A counter rather than a boolean: clicking a second link while the first is
	// still pending would otherwise clear the bar too early.
	const onPending = useCallback((delta: number) => {
		setPendingCount((count) => count + delta)
	}, [])

	return (
		/*
		 * Hand-built rather than Mantine's `<AppShell>` component: that one positions
		 * its navbar `fixed` and lets the *document* scroll, while this shell gives
		 * the content area its own scroll container (see AppShell.module.css) so the
		 * rail and the loading bar stay put with no width math. Nothing else it
		 * offers — a header, responsive collapse, a burger — is used here.
		 */
		<Flex h="100dvh" style={{ overflow: 'hidden' }}>
			{/* Left rail */}
			<Stack
				component="nav"
				aria-label={t('mainNav')}
				w={RAIL_WIDTH}
				align="center"
				gap="lg"
				py="lg"
				style={{ flexShrink: 0 }}
			>
				{/* mb on top of the Stack gap — the mark wants noticeably more air under
				    it than the nav squares want between themselves. */}
				<BlackHoleMark size={48} mb="lg" />

				<Stack flex={1} align="center" gap="sm">
					{navLinks.map((link) => (
						<NavItem
							key={link.href}
							href={link.href}
							icon={link.icon}
							label={t(link.labelKey)}
							active={pathname === link.href}
							onPending={onPending}
						/>
					))}
				</Stack>

				<Stack align="center" gap={4}>
					<LocaleSwitchButton />
					<ColorModeButton />
					<SignOutButton />
				</Stack>
			</Stack>

			{/* Content area */}
			<Box pos="relative" flex={1} miw={0} style={{ overflow: 'hidden' }}>
				{pendingCount > 0 && (
					/*
					 * Mantine has no indeterminate progress bar; a full-width animated
					 * one reads the same way — the stripes move, so it doesn't claim a
					 * position it doesn't know. `aria-label` is forwarded to the element
					 * carrying role="progressbar", which is what axe checks for
					 * (aria-progressbar-name).
					 */
					<Progress
						value={100}
						animated
						size="xs"
						radius={0}
						aria-label={t('loading')}
						pos="absolute"
						top={0}
						left={0}
						right={0}
						style={{ zIndex: 10 }}
					/>
				)}
				{/* key={pathname} restarts the enter animation on every navigation */}
				<div key={pathname} className={classes.content}>
					{children}
				</div>
			</Box>
		</Flex>
	)
}
