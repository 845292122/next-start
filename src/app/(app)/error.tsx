'use client'

import { Button } from '@mantine/core'
import Link from 'next/link'
import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * Error boundary for the (app) group.
 *
 * Exists separately from `app/error.tsx` purely for where it renders: this
 * one is inside `(app)/layout.tsx`, so `AppShell` is still mounted and a failed
 * page leaves the rail — and therefore navigation out of the failure — intact.
 * The outer boundary would replace the whole screen.
 *
 * Errors thrown by `(app)/layout.tsx` itself (the session guard) are not caught
 * here; they bubble to `app/error.tsx`.
 */
export default function AppGroupError({
	error,
	retry,
}: {
	error: Error & { digest?: string }
	retry: () => void
}) {
	useEffect(() => {
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
