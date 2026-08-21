import type { ReactElement } from 'react'
import { env } from '@/core/env'
import { logger } from '@/core/logger'
import { resend } from '@/core/mailer/client'

/**
 * Keeps the recipient's domain and drops the local part.
 *
 * The log line below exists to explain why no mail went out, and the domain is
 * the part that's actually diagnostic ("ah, the corporate ones are being
 * skipped"). The local part is PII with no diagnostic value, so it never reaches
 * disk. This is masked at the call site rather than left to `core/logger.ts`'s
 * redaction: that would replace the whole value with `[redacted]`, which is
 * strictly less useful.
 */
function maskEmail(address: string) {
	const at = address.lastIndexOf('@')
	return at === -1 ? '[malformed]' : `***@${address.slice(at + 1)}`
}

export async function sendEmail(options: {
	to: string
	subject: string
	react: ReactElement
}) {
	if (!resend) {
		logger.warn(
			{ recipient: maskEmail(options.to) },
			'RESEND_API_KEY not set, skipping email send',
		)
		return
	}

	await resend.emails.send({
		from: env.EMAIL_FROM,
		to: options.to,
		subject: options.subject,
		react: options.react,
	})
}
