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
	// self-hosted (non-Vercel) deployments don't get a canonical host injected
	// automatically — without this, Auth.js rejects requests with UntrustedHost.
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
