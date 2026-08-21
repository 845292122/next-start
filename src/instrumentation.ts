import type { Instrumentation } from 'next'
import { loggablePath, logger } from '@/core/logger'
import { REQUEST_ID_HEADER } from '@/core/request-id'

/**
 * Server-side error reporting.
 *
 * This is the counterpart to the wrappers in `core/action.ts` and `core/http.ts`:
 * they catch what *they* wrap, and `onRequestError` catches everything else —
 * above all, exceptions thrown while rendering Server Components, which nothing
 * in application code is in a position to intercept.
 *
 * It is also the only place the two halves of a production error meet. Next
 * replaces the message reaching the browser with a hash, so the error page can
 * only show that `digest` (see `components/ui/ErrorState.tsx`). **Without a hook
 * writing the digest next to the real stack on the server, a user-reported digest
 * leads nowhere.** That's the point of this file — the log line below is what
 * makes the digest on the error page mean something.
 *
 * A real deployment swaps `logger.error` here for Sentry/OTel/whatever. The shape
 * of the hook doesn't change.
 *
 * Nothing is exported as `register()`: there's no tracer to initialise. Add one
 * there if you wire up OpenTelemetry.
 */
export const onRequestError: Instrumentation.onRequestError = (
	error,
	request,
	context,
) => {
	// Per the Next docs, `error` is `unknown` — during Server Components rendering
	// React may hand over something other than the original throw. `digest` is the
	// reliable identifier, so it's read defensively rather than via a cast.
	const digest =
		typeof error === 'object' && error !== null && 'digest' in error
			? String(error.digest)
			: undefined

	// request.headers is a plain object here, not a Headers instance, so
	// resolveRequestId() doesn't apply. No fallback id is minted: an absent one
	// means the proxy didn't run for this request, and inventing a value that
	// appears nowhere else would only look like correlation.
	const headerValue = request.headers[REQUEST_ID_HEADER]
	const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue

	logger.error(
		{
			requestId,
			digest,
			method: request.method,
			// Not `request.path` raw: per the Next docs it includes the query string,
			// and this hook sees *every* route — including
			// /api/auth/callback/...?code=..., where that code is exchangeable for a
			// session. See loggablePath().
			path: loggablePath(request.path),
			// Which kind of thing failed: 'render' | 'route' | 'action' | 'proxy'.
			// Worth keeping — an error in a Server Action and the same error in a
			// render need different debugging.
			routePath: context.routePath,
			routeType: context.routeType,
			err: error,
		},
		'unhandled server error',
	)
}
