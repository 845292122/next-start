import { eq } from 'drizzle-orm'
import { db } from '@/core/db/client'
import { usersTable } from '@/core/db/schema'
import { env } from '@/core/env'
import { UnauthorizedError } from '@/core/errors'
import { logger } from '@/core/logger'

/**
 * WeChat mini program sign-in.
 *
 * ## ⚠️ This is an honest stub, like core/auth/otp.ts
 *
 * With `WECHAT_APPID` / `WECHAT_SECRET` unset it **does not call WeChat**. It
 * derives a deterministic fake `openid` from the code so the whole path — issue a
 * token, call `/api/v1/*` with it, read rows scoped to that user — is exercisable
 * end to end without credentials. `e2e/api-v1.e2e.ts` relies on exactly that.
 *
 * The real implementation is one fetch, and the shape below is already correct for
 * it:
 *
 * ```
 * GET https://api.weixin.qq.com/sns/jscode2session
 *       ?appid=…&secret=…&js_code=<code>&grant_type=authorization_code
 * → { openid, session_key, unionid?, errcode?, errmsg? }
 * ```
 *
 * Four things to get right when you wire it, none of which the stub can teach you:
 *
 * 1. **WeChat returns errors with HTTP 200.** Check `errcode`, not the status.
 *    `40029` is an invalid/expired code — that's the common one, and it maps to
 *    `UnauthorizedError`, not a 500.
 * 2. **A `code` is single-use and expires in ~5 minutes.** Never cache or retry it.
 * 3. **`session_key` must never reach the client**, and it rotates on every
 *    `wx.login()`. Store it server-side only if you need it (decrypting the phone
 *    number, signature checks) — see the note on `usersTable.openid`.
 * 4. **`unionid` only comes back with an Open Platform account.** If you have one,
 *    key the account on `unionid` instead so the same person is one user across
 *    your apps.
 *
 * The phone number is a **separate** interface (`getPhoneNumber` gives the client a
 * code you exchange server-side). Its quota and pricing have changed more than
 * once — check the current WeChat docs rather than assuming, and note it does *not*
 * reuse the phone-OTP path in core/auth/otp.ts.
 */

export type WeChatSession = {
	openid: string
	/** Kept out of anything that crosses the network. */
	sessionKey: string
	unionid?: string
}

const WECHAT_ENDPOINT = 'https://api.weixin.qq.com/sns/jscode2session'

export type WeChatCredentials = { appid?: string; secret?: string }

/** Whether real credentials are configured. */
export function isWeChatConfigured(credentials: WeChatCredentials = {}) {
	return (
		Boolean(credentials.appid ?? env.WECHAT_APPID) &&
		Boolean(credentials.secret ?? env.WECHAT_SECRET)
	)
}

/**
 * `credentials` defaults to the environment and is only passed explicitly by tests.
 *
 * Injecting them rather than mocking `@/core/env` is deliberate: bun's
 * `mock.module` is process-wide, and mocking env in one test file would silently
 * change `DATABASE_URL` and `LOG_LEVEL` for every other file in the run — the same
 * class of bug that made the suite write to the dev database once already (see
 * test/unit-setup.ts). A parameter can't leak.
 */
export async function exchangeMiniProgramCode(
	code: string,
	credentials: WeChatCredentials = {},
): Promise<WeChatSession> {
	const appid = credentials.appid ?? env.WECHAT_APPID
	const secret = credentials.secret ?? env.WECHAT_SECRET

	if (!appid || !secret) {
		// Deterministic so a test can sign in twice as "the same user".
		const openid = `stub-openid-${code}`
		logger.warn(
			{ openid },
			'WECHAT_APPID/WECHAT_SECRET not set, using a stub openid instead of calling WeChat',
		)
		return { openid, sessionKey: 'stub-session-key' }
	}

	const url = new URL(WECHAT_ENDPOINT)
	url.searchParams.set('appid', appid)
	url.searchParams.set('secret', secret)
	url.searchParams.set('js_code', code)
	url.searchParams.set('grant_type', 'authorization_code')

	const response = await fetch(url)
	const body = (await response.json()) as {
		openid?: string
		session_key?: string
		unionid?: string
		errcode?: number
		errmsg?: string
	}

	// Point 1 above: WeChat signals failure in the body, with a 200 status.
	if (body.errcode || !body.openid || !body.session_key) {
		// errmsg only — the code itself is a credential and `logger`'s redaction
		// covers the `code` key, but it isn't in scope here anyway.
		logger.warn(
			{ errcode: body.errcode, errmsg: body.errmsg },
			'WeChat code exchange failed',
		)
		throw new UnauthorizedError('wechat code exchange failed')
	}

	return {
		openid: body.openid,
		sessionKey: body.session_key,
		unionid: body.unionid,
	}
}

/**
 * Sign-in doubles as sign-up, the same way the phone path does.
 *
 * Insert-first rather than select-then-insert, for the same reason as
 * `findOrCreateUserByPhone`: two concurrent first-time logins would both see "no
 * such user", both insert, and the second would die on the unique index. Letting
 * the database arbitrate with `onConflictDoNothing` makes that a no-op instead.
 */
export async function findOrCreateUserByOpenid(openid: string) {
	const [created] = await db
		.insert(usersTable)
		.values({ openid })
		.onConflictDoNothing({ target: usersTable.openid })
		.returning()
	if (created) return created

	const [existing] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.openid, openid))
	return existing
}
