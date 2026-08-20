import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import type { DefaultSession, NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyPassword } from '@/core/auth/password'
import { credentialsSchema } from '@/core/auth/schema'
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
	// own: usersTable carries an extra passwordHash column, and the adapter would
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
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				const parsed = credentialsSchema.safeParse(credentials)
				if (!parsed.success) return null

				const [user] = await db
					.select()
					.from(usersTable)
					.where(eq(usersTable.email, parsed.data.email))
				if (!user?.passwordHash) return null

				const valid = await verifyPassword(
					parsed.data.password,
					user.passwordHash,
				)
				if (!valid) return null

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
