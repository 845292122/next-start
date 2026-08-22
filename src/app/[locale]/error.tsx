'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * Error boundary for everything under [locale] that isn't in the (app) group —
 * the login page, the catch-all 404 route, and so on. Pages inside (app) hit
 * `(app)/error.tsx` instead, which keeps the rail visible.
 *
 * This boundary sits *inside* `[locale]/layout.tsx` (an error file never wraps
 * the layout of its own segment), so `NextIntlClientProvider` is above it and
 * `useTranslations` works. An error thrown by that layout itself — `auth()`
 * failing, say — escapes to `app/global-error.tsx`, which has no provider and
 * therefore no translations.
 *
 * `retry`, not `reset`: Next 16 renamed it and made `retry` stable in 16.3.
 * `retry()` re-fetches and re-renders the boundary's children, where `reset()`
 * only clears the error state — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 */
export default function LocaleError({
	error,
	retry,
}: {
	error: Error & { digest?: string }
	retry: () => void
}) {
	const t = useTranslations('Errors')

	useEffect(() => {
		// In production `error.message` is a generic string and the real one is only
		// in the server log, keyed by `digest` — so this is for development. Wiring
		// a reporter here would only catch client-side errors; server-side ones go
		// through instrumentation.ts's onRequestError instead.
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
