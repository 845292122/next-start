'use client'

import {
	ActionIcon,
	Burger,
	AppShell as MantineAppShell,
	Progress,
	Stack,
	Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { TablerIcon } from '@tabler/icons-react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { navLinks } from '@/components/layout/NavLinks'
import { BlackHoleMark } from '@/components/ui/BlackHoleMark'
import { ColorModeButton } from '@/components/ui/color-mode'
import { SignOutButton } from '@/components/ui/sign-out-button'
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
	icon: TablerIcon
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
	const pathname = usePathname()
	const [pendingCount, setPendingCount] = useState(0)
	const [opened, { toggle, close }] = useDisclosure(false)

	// A counter rather than a boolean: clicking a second link while the first is
	// still pending would otherwise clear the bar too early.
	const onPending = useCallback((delta: number) => {
		setPendingCount((count) => count + delta)
	}, [])

	// The mobile navbar is a slide-in overlay, not a resize — it stays open
	// across a navigation unless told otherwise, and left open it would cover
	// the page that link just went to.
	// biome-ignore lint/correctness/useExhaustiveDependencies: close (from useDisclosure) is stable; biome's own fix suggestions for this line contradict each other between runs.
	useEffect(() => {
		close()
	}, [pathname, close])

	return (
		/*
		 * `h`/`overflow: hidden` on the root plus `classes.content`'s own
		 * `overflow: auto` on `Main` is what keeps this the same shape as before
		 * Mantine's `<AppShell>` replaced the hand-rolled version: the content area
		 * scrolls, the rail/header/loading bar don't, with no width math against the
		 * rail. That property doesn't come from `<AppShell>` itself — its `Main` is
		 * an ordinary flow element that just gets padding to clear the navbar/header,
		 * so this file has to add the scroll containment back explicitly.
		 */
		<MantineAppShell
			header={{ height: { base: 60, sm: 0 } }}
			navbar={{
				width: RAIL_WIDTH,
				breakpoint: 'sm',
				collapsed: { mobile: !opened },
			}}
			padding={0}
			h="100dvh"
			style={{ overflow: 'hidden' }}
		>
			{/* Only ever visible below `sm` — see the responsive `header.height` above,
			    which collapses it to nothing on wider screens. `hiddenFrom` on top of
			    that pulls the burger out of the desktop tab order rather than just
			    hiding it visually. */}
			<MantineAppShell.Header hiddenFrom="sm">
				<Stack h="100%" justify="center" px="md">
					<Burger
						opened={opened}
						onClick={toggle}
						size="sm"
						// The icon flips to a close (X) glyph when opened — the label has
						// to say what the button now *does*, not what it always does,
						// or a screen reader hears "open navigation" on a button that
						// would close it.
						aria-label={opened ? '关闭导航' : '打开导航'}
					/>
				</Stack>
			</MantineAppShell.Header>

			<MantineAppShell.Navbar aria-label="主导航">
				<Stack h="100%" align="center" gap="lg" py="lg">
					{/* Hidden on mobile: the header above already carries the mark while
					    the navbar is collapsed, and showing it twice when the drawer opens
					    over that same header would be redundant. mb on top of the Stack
					    gap — the mark wants noticeably more air under it than the nav
					    squares want between themselves. */}
					<BlackHoleMark size={48} mb="lg" visibleFrom="sm" />

					<Stack style={{ flex: 1 }} align="center" gap="sm">
						{navLinks.map((link) => (
							<NavItem
								key={link.href}
								href={link.href}
								icon={link.icon}
								label={link.label}
								active={pathname === link.href}
								onPending={onPending}
							/>
						))}
					</Stack>

					<Stack align="center" gap={4}>
						<ColorModeButton />
						<SignOutButton />
					</Stack>
				</Stack>
			</MantineAppShell.Navbar>

			<MantineAppShell.Main pos="relative" style={{ overflow: 'hidden' }}>
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
						aria-label="页面加载中"
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
			</MantineAppShell.Main>
		</MantineAppShell>
	)
}
