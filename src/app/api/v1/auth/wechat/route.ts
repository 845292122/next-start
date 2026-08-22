import { issueBearerToken } from '@/core/auth/verify'
import {
	exchangeMiniProgramCode,
	findOrCreateUserByOpenid,
	isWeChatConfigured,
} from '@/core/auth/wechat'
import { UnauthorizedError } from '@/core/errors'
import { readJson, withHandler } from '@/core/http'
import { wechatLoginSchema } from '@/features/auth/schema'

/**
 * `POST /api/v1/auth/wechat` — WeChat mini program sign-in.
 *
 * The client side is:
 *
 * ```js
 * const { code } = await wx.login()
 * const { token } = await request('/api/v1/auth/wechat', { code })
 * wx.setStorageSync('token', token)
 * // then: header { Authorization: `Bearer ${token}` }
 * ```
 *
 * **The only unauthenticated route under /api/v1**, which is why it's the one to
 * look at first in a security review. Everything else there requires a Bearer
 * token that only this endpoint mints.
 *
 * `code` is a WeChat credential, so it is never logged: `core/logger.ts` redacts the
 * `code` key, and nothing here puts it in a message either.
 *
 * Not rate limited yet — see the note at the bottom of this file.
 */
export const POST = withHandler(async (request) => {
	const { code } = await readJson(request, wechatLoginSchema)

	// Throws UnauthorizedError on a rejected code, which withHandler maps to 401.
	// With no credentials configured this returns a deterministic stub openid —
	// see core/auth/wechat.ts.
	const { openid } = await exchangeMiniProgramCode(code)

	const user = await findOrCreateUserByOpenid(openid)
	if (!user) throw new UnauthorizedError('could not resolve a user for openid')

	const token = await issueBearerToken(user.id)

	// Deliberately minimal: the token, and the id the client needs to correlate.
	// No openid — the client already knows who it is, and echoing an identifier back
	// only widens what a leaked response body reveals.
	return Response.json(
		{
			token,
			user: { id: user.id, name: user.name },
			stub: isWeChatConfigured() ? undefined : true,
		},
		{ status: 201 },
	)
})

/**
 * ⚠️ **Rate limit this before it goes live.** `core/rate-limit.ts` has the limiter;
 * this endpoint is unauthenticated and mints credentials, which is exactly the shape
 * that gets hammered. Keying is the open question — there's no phone number here and
 * the `code` is single-use, so it has to be the client IP, taken from a header *your
 * own reverse proxy* sets and never from a client-supplied `X-Forwarded-For`. See
 * DEVELOPMENT.md § 安全.
 */
