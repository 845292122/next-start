import type { ReactElement } from 'react'
import { env } from '@/core/env'
import { logger } from '@/core/logger'
import { resend } from '@/core/mailer/client'

export async function sendEmail(options: {
	to: string
	subject: string
	react: ReactElement
}) {
	if (!resend) {
		logger.warn(
			{ to: options.to },
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
