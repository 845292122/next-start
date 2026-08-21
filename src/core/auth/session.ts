import { auth } from '@/core/auth'
import { UnauthorizedError } from '@/core/errors'

/**
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
 */
export async function getRequiredSession() {
	const session = await auth()
	if (!session?.user) throw new UnauthorizedError()
	return session
}
