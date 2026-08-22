import { z } from 'zod'
import '@/core/zod-config'

/**
 * No real SMS provider is wired anywhere in this template — see
 * core/auth/otp.ts. The constant lives here, in a module with no server-only
 * imports, specifically so LoginForm (a Client Component) can show it in a
 * toast without pulling core/auth/otp.ts's database import chain into the
 * browser bundle. Importing a db-touching module from client code is exactly
 * what breaks the Turbopack build with "does not support external modules
 * (request: node:fs)" — that's the failure mode this split avoids.
 */
export const DEMO_VERIFICATION_CODE = '123456'

/**
 * Shared by the Credentials provider in core/auth/config.ts and by the sign-in
 * form in features/auth/. It lives in core/ rather than features/ so that the
 * dependency only ever points features → core, never the other way.
 *
 * No custom zod `.message()` here on purpose: zod's own messages are English
 * and this app is Chinese-only, so a message straight off the schema would be
 * the wrong language. LoginForm renders its own Chinese text keyed off which
 * field has an error, not off `error.message`.
 */
export const phoneOtpSchema = z.object({
	// CN mobile numbers specifically — this template's UI defaults to zh.
	// Swap the pattern (or make it locale-aware) for a different market.
	phone: z.string().regex(/^1[3-9]\d{9}$/),
	code: z.string().length(6),
})

export type PhoneOtp = z.infer<typeof phoneOtpSchema>
