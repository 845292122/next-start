'use client'

import {
	Button,
	Center,
	Code,
	Group,
	Stack,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

/**
 * The shared body of the error boundaries — `app/error.tsx` and
 * `app/(app)/error.tsx` differ only in what wraps them, so the visible part
 * lives here once.
 *
 * Takes finished strings rather than owning them itself, which keeps it usable
 * from `global-error.tsx` too — except that boundary deliberately doesn't use
 * this component either (see the note there).
 *
 * Shape follows (app)/403/page.tsx and not-found.tsx so the three error screens
 * read as one family.
 */
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
	 * `next/navigation`. That keeps it renderable in a plain component test
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
		<Center mih="60vh" p="lg">
			<Stack align="center" gap="md" maw={400} ta="center">
				<ThemeIcon color="red" variant="light" size={72} radius="xl">
					<IconAlertTriangle size={36} />
				</ThemeIcon>
				{/*
				 * order={1} for the document outline, size="h2" for the visual weight —
				 * this is a full-screen state, so it owns the page's only <h1>, but it
				 * shouldn't shout like a marketing headline.
				 */}
				<Title order={1} size="h2">
					{title}
				</Title>
				<Text c="dimmed">{description}</Text>

				{/*
				 * The digest is the only thread between what the user sees and what
				 * landed in the server log — in production Next replaces the real
				 * message with this hash. Worth surfacing so a bug report can carry it.
				 */}
				{digest && digestLabel && <Code>{digestLabel}</Code>}

				<Group mt="xs" gap="sm">
					<Button onClick={onRetry}>{retryLabel}</Button>
					{/*
					 * The escape hatch matters as much as retry does: if the failure is
					 * permanent, a retry button on its own leaves the user stuck.
					 */}
					{homeLink}
				</Group>
			</Stack>
		</Center>
	)
}
