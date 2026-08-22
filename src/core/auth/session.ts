import type { Session } from 'next-auth'
import {
	requireSession,
	sessionFromBearer,
	sessionFromCookie,
} from '@/core/auth/verify'

/**
 * The cookie-transport session, for pages, Server Actions and the cookie-based
 * Route Handlers.
 *
 * Throws rather than redirects, and throws a typed error rather than a bare
 * `Error`.
 *
 * The code on the error is what lets one call site serve three consumers:
 * `core/action.ts` turns it into `{ ok: false, code: 'UNAUTHORIZED' }`,
 * `core/http.ts` turns it into a 401, and in a Server Component it reaches
 * `error.tsx`. Matching on a message string (`err.message === 'unauthorized'`)
 * is what this replaces.
 *
 * Pages don't normally rely on this for the redirect: `(app)/layout.tsx` has
 * already bounced anyone signed out, so a page reaching this throw means the
 * guard was bypassed or removed — a bug, and it should surface as one.
 *
 * Behaviour is unchanged from before the two transports were split; it's now
 * `requireSession(sessionFromCookie())`, and `core/auth/verify.ts` explains why the
 * transports must not be merged.
 */
export async function getRequiredSession(): Promise<Session> {
	return requireSession(await sessionFromCookie())
}

/**
 * The Bearer-transport session, for `/api/v1/*`.
 *
 * **Reads only the `Authorization` header — a cookie on the request is ignored.**
 * That's what keeps this surface free of CSRF by construction; see the long note in
 * `core/auth/verify.ts` and the assertion in `e2e/api-v1.e2e.ts`.
 */
export async function getRequiredBearerSession(
	request: Request,
): Promise<Session> {
	return requireSession(await sessionFromBearer(request))
}
