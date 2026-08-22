'use client'

import { Button } from '@mantine/core'
import Link from 'next/link'
import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * Error boundary for everything that isn't in the (app) group — the login
 * page, the 404, and so on. Pages inside (app) hit `(app)/error.tsx` instead,
 * which keeps the rail visible.
 *
 * This boundary sits *inside* `app/layout.tsx` (an error file never wraps the
 * layout of its own segment). An error thrown by that layout itself — `auth()`
 * failing, say — escapes to `app/global-error.tsx`, which has no provider
 * above it and can't reuse this component (see the note there).
 *
 * `retry`, not `reset`: Next 16 renamed it and made `retry` stable in 16.3.
 * `retry()` re-fetches and re-renders the boundary's children, where `reset()`
 * only clears the error state — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 */
export default function RootError({
	error,
	retry,
}: {
	error: Error & { digest?: string }
	retry: () => void
}) {
	useEffect(() => {
		// In production `error.message` is a generic string and the real one is only
		// in the server log, keyed by `digest` — so this is for development. Wiring
		// a reporter here would only catch client-side errors; server-side ones go
		// through instrumentation.ts's onRequestError instead.
		console.error(error)
	}, [error])

	return (
		<ErrorState
			title="这个页面没能加载出来"
			description="渲染时出了点问题。重试一次通常就好了；如果一直这样，把下面的错误编号发给我们。"
			retryLabel="重试"
			homeLink={
				<Button component={Link} href="/" replace variant="default">
					回到首页
				</Button>
			}
			digest={error.digest}
			digestLabel={error.digest ? `错误编号 ${error.digest}` : undefined}
			onRetry={retry}
		/>
	)
}
