'use client'

import { ProgressBar, Tooltip } from '@heroui/react'
// useLinkStatus still comes from next/link — the Link below wraps it, so the
// hook reads the same context.
import { useLinkStatus } from 'next/link'
import { useTranslations } from 'next-intl'
import { type ComponentType, useCallback, useEffect, useState } from 'react'
import { navLinks } from '@/components/layout/NavLinks'
import { BlackHoleMark } from '@/components/ui/BlackHoleMark'
import { ColorModeButton } from '@/components/ui/color-mode'
import { LocaleSwitchButton } from '@/components/ui/locale-switch'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { Link, usePathname } from '@/i18n/navigation'

/**
 * Reports its <Link> parent's pending state upwards so the content area can
 * show a loading bar. Prefetched routes navigate instantly and never go
 * pending, so in practice the bar only appears when navigation really blocks.
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
 * `rounded-3xl` rather than a hand-picked pixel radius: that token is
 * `--radius * 3`, which is also what HeroUI's own `.button` base uses, so the
 * nav squares and the buttons underneath them stay the same shape when
 * `--radius` changes in globals.css.
 *
 * The label moves into `aria-label`, which keeps the accessible name the same
 * as when it was visible text — that's what the rail's e2e assertions match on.
 */
function NavItem({
	label,
	icon: Icon,
	href,
	active,
	onPending,
}: {
	label: string
	icon: ComponentType<{ className?: string }>
	href: string
	active: boolean
	onPending: (delta: number) => void
}) {
	return (
		<Tooltip delay={300}>
			{/*
			 * Tooltip.Trigger wraps the link rather than the link being the trigger
			 * itself: react-aria only hands its trigger props to a focusable
			 * component of its own (its Button/Link), and this has to stay a
			 * next/link to keep prefetching and useLinkStatus. Hover therefore
			 * opens the tooltip but keyboard focus does not — `aria-label` is what
			 * carries the name for assistive tech, so nothing is lost there.
			 */}
			<Tooltip.Trigger>
				<Link
					href={href}
					aria-label={label}
					data-active={active || undefined}
					className="bg-default text-muted hover:bg-default-hover hover:text-foreground data-active:bg-accent data-active:text-accent-foreground data-active:shadow-md flex size-11 items-center justify-center rounded-3xl transition-colors"
				>
					<Icon className="size-5" />
					<LinkPending onPending={onPending} />
				</Link>
			</Tooltip.Trigger>
			<Tooltip.Content placement="right">{label}</Tooltip.Content>
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
		 * bg-surface on the shell, not on <body>: it makes the rail and the content
		 * area the same white, while leaving the (auth) group — which has no
		 * AppShell — on the page background.
		 */
		<div className="bg-surface flex h-dvh overflow-hidden">
			{/* Left rail */}
			<nav
				aria-label={t('mainNav')}
				className="flex w-22 shrink-0 flex-col items-center gap-6 py-6"
			>
				{/* mb on top of the flex gap — the mark wants noticeably more air
				    under it than the nav squares want between themselves. */}
				<BlackHoleMark className="mb-6 size-12" />

				<div className="flex flex-1 flex-col items-center gap-3">
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
				</div>

				<div className="flex flex-col items-center gap-1">
					<LocaleSwitchButton />
					<ColorModeButton />
					<SignOutButton />
				</div>
			</nav>

			{/* Content area */}
			<div className="relative min-w-0 flex-1 overflow-hidden">
				{pendingCount > 0 && (
					<ProgressBar
						isIndeterminate
						aria-label={t('loading')}
						className="absolute inset-x-0 top-0 z-10"
					>
						<ProgressBar.Track className="h-0.5 rounded-none">
							<ProgressBar.Fill />
						</ProgressBar.Track>
					</ProgressBar>
				)}
				{/* key={pathname} restarts the enter animation on every navigation */}
				<div
					key={pathname}
					className="animate-page-enter h-full w-full overflow-auto"
				>
					{children}
				</div>
			</div>
		</div>
	)
}
