'use client'

import { Button, buttonVariants, Heading, Paragraph } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'

/**
 * The shared body of the error boundaries — `app/[locale]/error.tsx` and
 * `app/[locale]/(app)/error.tsx` differ only in what wraps them, so the visible
 * part lives here once.
 *
 * Takes finished strings rather than calling `useTranslations` itself: that keeps
 * it usable from a boundary that has no i18n provider above it. (`global-error`
 * is exactly that case, but it deliberately doesn't use this component either —
 * see the note in app/global-error.tsx.)
 *
 * Shape follows (app)/403/page.tsx and [locale]/not-found.tsx so the three error
 * screens read as one family.
 */

/**
 * Class for the escape-hatch link, so both boundaries style it identically.
 *
 * `buttonVariants()` rather than `<Button>`: HeroUI's Button is a `<button>` and
 * takes no href. Same escape hatch as (app)/403/page.tsx.
 */
export const errorStateLinkClass = buttonVariants({ variant: 'secondary' })

export function ErrorState({
	title,
	description,
	retryLabel,
	homeLink,
	digest,
	digestLabel,
	onRetry,
}: {
	title: string
	description: string
	retryLabel: string
	/**
	 * The "back to safety" link, supplied by the caller.
	 *
	 * A slot rather than an `href` prop so this component imports nothing from
	 * `@/i18n/navigation`. That keeps it renderable in a plain component test
	 * without mocking that module — and mocking it here would clobber
	 * `LoginForm.test.tsx`'s mock of the same module, because bun's `mock.module`
	 * is process-wide and the dom suite runs every file in one process.
	 */
	homeLink: React.ReactNode
	/** Next's hash of the server-side error, absent for client-side ones. */
	digest?: string
	digestLabel?: string
	onRetry: () => void
}) {
	return (
		<div className="flex min-h-[60vh] items-center justify-center p-6">
			<div className="flex max-w-100 flex-col items-center gap-4 text-center">
				<div className="bg-danger-soft text-danger-soft-foreground flex size-18 items-center justify-center rounded-full">
					<TriangleAlert className="size-9" />
				</div>
				<Heading level={1} className="text-2xl">
					{title}
				</Heading>
				<Paragraph className="text-muted">{description}</Paragraph>

				{/*
				 * The digest is the only thread between what the user sees and what
				 * landed in the server log — in production Next replaces the real
				 * message with this hash. Worth surfacing so a bug report can carry it.
				 */}
				{digest && digestLabel && (
					<code className="text-muted bg-surface-secondary rounded px-2 py-1 font-mono text-xs">
						{digestLabel}
					</code>
				)}

				<div className="mt-2 flex items-center gap-3">
					<Button variant="primary" onPress={onRetry}>
						{retryLabel}
					</Button>
					{/*
					 * The escape hatch matters as much as retry does: if the failure is
					 * permanent, a retry button on its own leaves the user stuck.
					 */}
					{homeLink}
				</div>
			</div>
		</div>
	)
}
