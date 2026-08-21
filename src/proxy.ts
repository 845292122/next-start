import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/core/request-id'
import { routing } from '@/i18n/routing'

/**
 * Next 16 renamed the `middleware` file convention to `proxy` — the export name
 * changed with it, but next-intl's factory is still published under
 * `next-intl/middleware`.
 *
 * **Do not import `core/logger.ts` here.** Its pino transport spawns a worker
 * thread. Next 16 runs the proxy on the Node runtime by default (it was Edge in
 * 15), so it might even work — but the Next docs are explicit that the proxy "can
 * run outside of your application's main runtime" and may be deployed to a CDN,
 * and that you "should not attempt relying on shared modules or globals". Nothing
 * here logs, for that reason.
 *
 * That same constraint is why the request id travels as a **header** rather than
 * through an AsyncLocalStorage shared with the app: headers, cookies and the URL
 * are the only supported channels from proxy to application.
 */
const handleI18nRouting = createMiddleware(routing)

export function proxy(request: NextRequest) {
	// Honour an id from a load balancer or CDN if there is one, so their logs and
	// ours join up; otherwise mint one.
	const requestId = resolveRequestId(request.headers)

	// Mutating the incoming headers *before* next-intl runs is what gets the id
	// upstream to the render. next-intl builds its forwarded headers with
	// `new Headers(request.headers)` and passes them to
	// `NextResponse.next({ request: { headers } })` / `.rewrite(...)` (verified in
	// node_modules/next-intl/dist/esm/development/middleware/middleware.js), so
	// anything set here is carried along. Composing the other way round — letting
	// next-intl produce the response and then trying to add a *request* header to
	// it — isn't possible without Next's internal `x-middleware-override-headers`
	// protocol.
	request.headers.set(REQUEST_ID_HEADER, requestId)

	// This is what resolves a request to a locale: it reads the [locale] segment,
	// falls back to the `NEXT_LOCALE` cookie and then `Accept-Language`, and
	// redirects when the URL doesn't match the resolved locale.
	const response = handleI18nRouting(request)

	// Also on the way out, so a browser request can be correlated from the client
	// side (devtools, a bug report, an uptime monitor).
	response.headers.set(REQUEST_ID_HEADER, requestId)

	return response
}

export const config = {
	// Everything except API routes, Next internals and files with an extension
	// (which covers /favicon.ico and anything served from /public).
	//
	// Note the consequence for the request id: **`/api/*` never gets one from
	// here**, which is why `core/http.ts`'s `withHandler` mints its own.
	matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
