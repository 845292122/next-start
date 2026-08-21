import type { Instrumentation } from 'next'
import { env } from '@/core/env'
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
 */

/**
 * Runs once per server instance, before the first request is served.
 *
 * Used here only for a boot-time configuration check. This is the right place for
 * it: it runs exactly once, on the server, early enough to be seen in deploy logs
 * — and unlike a check inside a request path it can't be missed or spammed.
 *
 * Initialise a tracer here too if you wire up OpenTelemetry.
 */
export function register() {
	if (env.NODE_ENV === 'production' && !env.AUTH_URL) {
		// A warning rather than a throw: refusing to boot would turn a hardening
		// recommendation into an outage for anyone upgrading. See the `trustHost`
		// note in core/auth/config.ts for what's actually at risk.
		logger.warn(
			"AUTH_URL is not set. Auth.js will derive callback URLs from the Host header, which anything in front of the app can set. Set AUTH_URL to this deployment's canonical origin.",
		)
	}
}
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
