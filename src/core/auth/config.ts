import { DrizzleAdapter } from '@auth/drizzle-adapter'
import type { DefaultSession, NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { findOrCreateUserByPhone } from '@/core/auth/otp'
import { DEMO_VERIFICATION_CODE, phoneOtpSchema } from '@/core/auth/schema'
import { db } from '@/core/db/client'
import {
	accountsTable,
	sessionsTable,
	usersTable,
	verificationTokensTable,
} from '@/core/db/schema'
import { env } from '@/core/env'
import { logger } from '@/core/logger'
import { signInLimiter } from '@/core/rate-limit'

declare module 'next-auth' {
	interface Session {
		user: DefaultSession['user'] & { id: string }
	}
}

export const authConfig: NextAuthConfig = {
	// The tables are passed explicitly rather than letting the adapter define its
	// own: usersTable carries an extra phone column, and the adapter would
	// otherwise build a second, conflicting definition of `user`.
	//
	// authenticatorsTable is left out — it's WebAuthn-only and there's no such
	// table in the schema. The adapter fills in a default definition for it, so
	// its WebAuthn methods would fail at runtime if called; nothing here calls
	// them.
	adapter: DrizzleAdapter(db, {
		usersTable,
		accountsTable,
		sessionsTable,
		verificationTokensTable,
	}),
	// Credentials provider only supports JWT-strategy sessions — the adapter
	// above still handles OAuth account linking + verification tokens, it just
	// never persists a session row for the credentials user.
	session: { strategy: 'jwt' },
	secret: env.AUTH_SECRET,
	// Self-hosted (non-Vercel) deployments don't get a canonical host injected
	// automatically — without this, Auth.js rejects every request with
	// UntrustedHost, so a zero-config `bun run start` wouldn't work at all.
	//
	// The cost is real, though: with it on and `AUTH_URL` unset, Auth.js derives
	// callback and redirect URLs from the incoming `Host` header, which anything in
	// front of the app can set. **Set `AUTH_URL` in production** — then the
	// canonical origin comes from configuration and the Host header stops
	// mattering. `instrumentation.ts` logs a warning at boot if it's missing, and
	// `DEVELOPMENT.md` covers the reverse-proxy side.
	trustHost: true,
	pages: {
		// Without this, an unauthenticated Auth.js redirect lands on its own
		// built-in page at /api/auth/signin instead of the one in
		// app/[locale]/(auth)/login. No locale prefix: the proxy resolves it.
		signIn: '/login',
	},
	providers: [
		Credentials({
			id: 'phone-otp',
			credentials: {
				phone: { label: 'Phone', type: 'text' },
				code: { label: 'Code', type: 'text' },
			},
			async authorize(credentials) {
				const parsed = phoneOtpSchema.safeParse(credentials)
				if (!parsed.success) return null

				// Rate limited *before* the code is compared, and keyed by phone — see
				// core/rate-limit.ts. Without this a 6-digit code is walkable: nothing
				// else here costs an attacker anything per attempt.
				//
				// Returning null rather than throwing, so the client sees the same
				// "wrong code" outcome either way. Telling an attacker "you are being
				// throttled" hands them the information needed to pace around it, and
				// Auth.js has no channel for a distinct code here anyway.
				const limit = signInLimiter.check(`signin:${parsed.data.phone}`)
				if (!limit.allowed) {
					logger.warn(
						{ retryAfterMs: limit.retryAfterMs },
						'sign-in rate limit hit',
					)
					return null
				}

				// See core/auth/otp.ts — this is a fixed demo code, not a real
				// per-phone verification.
				if (parsed.data.code !== DEMO_VERIFICATION_CODE) return null

				const user = await findOrCreateUserByPhone(parsed.data.phone)
				return {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
				}
			},
		}),
	],
	callbacks: {
		jwt({ token, user }) {
			if (user) token.id = user.id
			return token
		},
		session({ session, token }) {
			if (session.user) session.user.id = token.id as string
			return session
		},
	},
}
