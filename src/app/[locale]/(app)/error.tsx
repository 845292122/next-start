'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * Error boundary for the (app) group.
 *
 * Exists separately from `[locale]/error.tsx` purely for where it renders: this
 * one is inside `(app)/layout.tsx`, so `AppShell` is still mounted and a failed
 * page leaves the rail — and therefore navigation out of the failure — intact.
 * The outer boundary would replace the whole screen.
 *
 * Errors thrown by `(app)/layout.tsx` itself (the session guard) are not caught
 * here; they bubble to `[locale]/error.tsx`.
 */
export default function AppGroupError({
	error,
	retry,
}: {
	error: Error & { digest?: string }
	retry: () => void
}) {
	const t = useTranslations('Errors')

	useEffect(() => {
		console.error(error)
	}, [error])

	return (
		<ErrorState
			title={t('title')}
			description={t('description')}
			retryLabel={t('retry')}
			homeLink={
				<ButtonLink href="/" replace variant="default">
					{t('backHome')}
				</ButtonLink>
			}
			digest={error.digest}
			digestLabel={
				error.digest ? t('digest', { digest: error.digest }) : undefined
			}
			onRetry={retry}
		/>
	)
}
