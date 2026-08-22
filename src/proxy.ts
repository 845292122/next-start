import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/core/request-id'
import { buildContentSecurityPolicy } from '@/core/security-headers'

/**
 * The header Next reads the nonce from, and the one `app/layout.tsx` forwards
 * to Mantine's `<ColorSchemeScript>`. The name is Next's convention.
 */
const NONCE_HEADER = 'x-nonce'
const CSP_HEADER = 'Content-Security-Policy'

/**
 * Next 16 renamed the `middleware` file convention to `proxy` — the export name
 * changed with it.
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
export function proxy(request: NextRequest) {
	// Honour an id from a load balancer or CDN if there is one, so their logs and
	// ours join up; otherwise mint one.
	const requestId = resolveRequestId(request.headers)

	// Mutating the incoming headers and passing them back through
	// `NextResponse.next({ request: { headers } })` is what gets the id upstream
	// to the render — that's the supported way to add a *request* header from the
	// proxy; there's no way to do it by mutating the response afterwards.
	request.headers.set(REQUEST_ID_HEADER, requestId)

	// A fresh nonce per request — a reused one is no better than 'unsafe-inline'.
	const nonce = crypto.randomUUID()
	const csp = buildContentSecurityPolicy({
		nonce,
		isDev: process.env.NODE_ENV === 'development',
	})

	// Both of these go on the *request*, and both are needed for different readers:
	//
	// - Next parses the `nonce-...` out of the CSP header on the request and
	//   attaches that nonce to the framework scripts, page chunks and its own
	//   inline styles automatically. Set it only on the response and none of that
	//   happens.
	// - `x-nonce` is for our own code: `app/layout.tsx` reads it and hands it to
	//   Mantine's `<ColorSchemeScript>` and to `MantineProvider`, neither of which
	//   Next knows anything about.
	request.headers.set(CSP_HEADER, csp)
	request.headers.set(NONCE_HEADER, nonce)

	const response = NextResponse.next({ request: { headers: request.headers } })

	// The CSP has to be on the response too — that's the copy the browser enforces.
	response.headers.set(CSP_HEADER, csp)

	// Request id also on the way out, so a browser request can be correlated from
	// the client side (devtools, a bug report, an uptime monitor).
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
