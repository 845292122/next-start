import { z } from 'zod'

/**
 * Shared by the Credentials provider in core/auth/config.ts and by the sign-in
 * form in features/auth/. It lives in core/ rather than features/ so that the
 * dependency only ever points features → core, never the other way.
 */
export const credentialsSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
})

export type Credentials = z.infer<typeof credentialsSchema>
