'use client'

import { useTranslations } from 'next-intl'
import type { ActionFailure } from '@/core/action-result'
import type { AppErrorCode } from '@/core/errors'

/**
 * Turns an `ActionFailure` into a translated, user-facing sentence.
 *
 * This is the client half of the error contract: the server sends a `code` and
 * nothing else (see `core/action-result.ts` on why no message travels), and the
 * mapping from code to wording is a UI concern that has to happen per locale.
 *
 * Every `AppErrorCode` gets an entry — `Errors.code.*` in the message files.
 * Keeping the map explicit rather than interpolating `t(\`code.${code}\`)` is
 * what makes next-intl's generated key types check it: add a code to
 * `core/errors.ts` without adding a message and `bun run typecheck` fails here,
 * which is the whole point. A dynamic template string would silently fall back to
 * rendering the key name at runtime instead.
 */
const MESSAGE_KEY: Record<AppErrorCode, `code.${AppErrorCode}`> = {
	VALIDATION: 'code.VALIDATION',
	UNAUTHORIZED: 'code.UNAUTHORIZED',
	FORBIDDEN: 'code.FORBIDDEN',
	NOT_FOUND: 'code.NOT_FOUND',
	CONFLICT: 'code.CONFLICT',
	RATE_LIMITED: 'code.RATE_LIMITED',
	INTERNAL: 'code.INTERNAL',
}

export function useActionErrorMessage() {
	const t = useTranslations('Errors')
	return (failure: ActionFailure) => t(MESSAGE_KEY[failure.code])
}
