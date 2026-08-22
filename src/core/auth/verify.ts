import type { Session } from 'next-auth'
import { decode, encode } from 'next-auth/jwt'
import { auth } from '@/core/auth'
import { env } from '@/core/env'
import { UnauthorizedError } from '@/core/errors'

/**
 * One verification core, two transports.
 *
 * A browser and a WeChat mini program cannot carry a session the same way, and
 * the difference is *only* about where the credential lives:
 *
 * - **Browser → httpOnly cookie.** Auth.js manages it. Unreadable from JS, so XSS
 *   can't steal it, and `SameSite=Lax` is what makes the CSRF reasoning in
 *   DEVELOPMENT.md § 安全 hold.
 * - **Mini program / native app → `Authorization: Bearer`.** `wx.request` has no
 *   dependable cookie jar, so the token is stored by the client and sent as a
 *   header.
 *
 * Everything after "which user is this" is identical, which is why the split stops
 * here: both transports produce a `Session`, and `core/services/` never learns
 * which one was used — it takes a `userId` and nothing else.
 *
 * ## Why the transports are kept apart rather than merged
 *
 * It would be less code to have one function that tries the cookie *and* the
 * header. **Don't.** A route that accepts both is CSRF-exposed again: the browser
 * attaches the cookie automatically, so a cross-site form post to a Bearer
 * endpoint would authenticate. Keeping them separate makes each surface's security
 * argument independent and simple:
 *
 * - Server Actions and `/api/notes` → cookie only.
 * - `/api/v1/*` → Bearer only, so it has no CSRF surface *by construction*.
 *
 * `e2e/api-v1.e2e.ts` asserts a cookie-carrying request to `/api/v1` gets a 401.
 */

/**
 * The `salt` Auth.js derives its encryption key with, alongside `AUTH_SECRET`.
 *
 * A constant of our own rather than Auth.js's cookie name: these tokens are *not*
 * session cookies, and giving them a distinct salt means a leaked Bearer token
 * can't be replayed as a cookie session, or the reverse.
 */
const BEARER_SALT = 'api-v1-bearer'

/** 30 days. Long enough that a mini program user isn't re-authenticating weekly. */
const BEARER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Mints a Bearer token for a user.
 *
 * Uses Auth.js's own `encode` rather than a hand-rolled JWT: it's already a
 * dependency, it produces an encrypted (JWE) token rather than a merely signed
 * one, and it derives its key from `AUTH_SECRET` — so there's no second secret to
 * manage or rotate.
 *
 * ⚠️ **There is no refresh token and no revocation list.** A minted token is valid
 * until it expires; rotating `AUTH_SECRET` invalidates all of them at once, which
 * is the only revocation available. That's acceptable for a template and *not*
 * acceptable if you need "sign out this one device" — see
 * DEVELOPMENT.md § 多端认证.
 */
export async function issueBearerToken(userId: string): Promise<string> {
	return encode({
		token: { id: userId },
		secret: env.AUTH_SECRET,
		salt: BEARER_SALT,
		maxAge: BEARER_MAX_AGE_SECONDS,
	})
}

/** The browser transport. Reads the Auth.js session cookie. */
export async function sessionFromCookie(): Promise<Session | null> {
	return auth()
}

/**
 * The header transport. Reads `Authorization: Bearer <token>`.
 *
 * Never touches cookies — see the note above on why that's the point rather than
 * an omission.
 */
export async function sessionFromBearer(
	request: Request,
): Promise<Session | null> {
	const header = request.headers.get('authorization')
	if (!header?.startsWith('Bearer ')) return null

	const token = header.slice('Bearer '.length).trim()
	if (!token) return null

	/**
	 * The payload we put in, spelled out because `decode` is generic and defaults to
	 * Auth.js's own `JWT` shape, which doesn't have our `id`.
	 */
	type BearerPayload = { id?: unknown; exp?: number }

	// `decode` returns null for a token that's expired, tampered with, or signed
	// with a different secret — all of which are just "no session" here. It can also
	// throw on a structurally invalid token, hence the catch.
	let payload: BearerPayload | null = null
	try {
		payload = await decode<BearerPayload>({
			token,
			secret: env.AUTH_SECRET,
			salt: BEARER_SALT,
		})
	} catch {
		return null
	}

	if (!payload) return null
	const id = typeof payload.id === 'string' ? payload.id : undefined
	if (!id) return null

	// `exp` is seconds since epoch, per JWT. Falling back to "now + max age" only
	// matters if a token somehow carries no exp; `decode` would already have rejected
	// an expired one.
	const expiresAt = payload.exp
		? payload.exp * 1000
		: Date.now() + BEARER_MAX_AGE_SECONDS * 1000

	// Same shape the `session` callback in core/auth/config.ts produces, so callers
	// can't tell the transports apart.
	return {
		user: { id, name: null, email: null, image: null },
		expires: new Date(expiresAt).toISOString(),
	} as Session
}

/**
 * The shared half: a missing session is an `UnauthorizedError`, whichever
 * transport was used.
 *
 * `core/action.ts` turns that into `{ ok: false, code: 'UNAUTHORIZED' }` and
 * `core/http.ts` into a 401 — see DEVELOPMENT.md § 错误处理.
 */
export function requireSession(session: Session | null): Session {
	if (!session?.user) throw new UnauthorizedError()
	return session
}
