import { z } from 'zod'
import '@/core/zod-config'

/**
 * Input for `POST /api/v1/auth/wechat`.
 *
 * `code` is what `wx.login()` hands the client. It's opaque to us, single-use, and
 * expires in about five minutes — so there's nothing to validate beyond "a
 * plausible non-empty string". The bound exists so a caller can't make us forward
 * a megabyte to WeChat.
 *
 * In `features/auth/` rather than `core/`: it's only used by the exposure layer, and
 * `core/` must not depend on `features/` (see DEVELOPMENT.md § 分层与依赖方向).
 * Contrast `core/auth/schema.ts`, which lives in core precisely because the
 * Credentials provider *inside* core needs it.
 */
export const wechatLoginSchema = z.object({
	code: z.string().min(1).max(512),
})

export type WeChatLoginInput = z.infer<typeof wechatLoginSchema>
