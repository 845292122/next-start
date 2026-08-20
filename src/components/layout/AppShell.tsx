'use client'

import { Button, ProgressBar, Tooltip } from '@heroui/react'
import { Plus } from 'lucide-react'
// useLinkStatus still comes from next/link — the Link below wraps it, so the
// hook reads the same context.
import { useLinkStatus } from 'next/link'
import { useTranslations } from 'next-intl'
import { type ComponentType, useCallback, useEffect, useState } from 'react'
import { navLinks } from '@/components/layout/NavLinks'
import { AccountMenu } from '@/components/ui/account-menu'
import { ColorModeButton } from '@/components/ui/color-mode'
import { LocaleSwitchButton } from '@/components/ui/locale-switch'
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
 * The active state is one solid block with the icon and the label inside it,
 * built from HeroUI's accent-soft tokens so it follows the theme and the color
 * scheme without a second rule for dark mode.
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
		<Link href={href} className="block w-full no-underline">
			{/*
			 * A span, not a button: the <a> above is already the interactive
			 * element, and nesting a button inside a link breaks keyboard
			 * semantics.
			 */}
			<span
				data-active={active || undefined}
				className="text-muted hover:bg-surface-hover hover:text-foreground data-active:bg-accent-soft data-active:text-accent-soft-foreground flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 transition-colors"
			>
				<Icon className={active ? 'size-5.5 stroke-[2.2]' : 'size-5.5'} />
				<span className="text-xs leading-tight font-medium">{label}</span>
			</span>
			<LinkPending onPending={onPending} />
		</Link>
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
		<div className="flex h-dvh overflow-hidden">
			{/* Left rail */}
			<nav
				aria-label={t('mainNav')}
				className="bg-surface border-border flex w-22 shrink-0 flex-col items-center gap-2 border-r pt-6 pb-2"
			>
				{/* Primary action */}
				<Tooltip delay={300}>
					<Button variant="primary" isIconOnly aria-label={t('new')}>
						<Plus className="size-5.5" />
					</Button>
					<Tooltip.Content placement="right">{t('new')}</Tooltip.Content>
				</Tooltip>

				{/* Nav items */}
				<div className="mt-2 flex w-full flex-1 flex-col gap-1 px-2">
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

				{/* Bottom: language + light/dark toggle + account */}
				<div className="flex flex-col items-center gap-1 pb-1">
					<LocaleSwitchButton />
					<ColorModeButton />
					<AccountMenu />
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
