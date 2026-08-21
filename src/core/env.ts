import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
	server: {
		NODE_ENV: z
			.enum(['development', 'test', 'production'])
			.default('development'),
		// A filesystem path, not a URL: better-sqlite3 opens it directly and
		// drizzle-kit's dbCredentials.url accepts the same bare path, so one
		// variable serves both. ':memory:' is also valid — that's what the unit
		// tests set.
		DATABASE_URL: z.string().min(1).default('./data/dev.db'),
		AUTH_SECRET: z.string().min(1),
		// The app's canonical origin, e.g. https://example.com. Optional, but
		// production should set it: without it Auth.js derives callback and redirect
		// URLs from the request's Host header, which anything in front of the app can
		// set. See the note on `trustHost` in core/auth/config.ts. Read by Auth.js
		// straight from process.env — declared here so it's discoverable and
		// validated, and so instrumentation.ts can warn when it's missing.
		AUTH_URL: z.url().optional(),
		LOG_LEVEL: z
			.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
			.default('info'),
		RESEND_API_KEY: z.string().min(1).optional(),
		// Resend's shared test sender, which only delivers to the address that owns
		// the API key. Defaulted rather than required so a fresh clone boots with
		// no mail configuration at all — but it has to be replaced with an address
		// on a verified domain before any real mail goes out.
		EMAIL_FROM: z.string().min(1).default('onboarding@resend.dev'),
	},
	client: {},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		DATABASE_URL: process.env.DATABASE_URL,
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_URL: process.env.AUTH_URL,
		LOG_LEVEL: process.env.LOG_LEVEL,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		EMAIL_FROM: process.env.EMAIL_FROM,
	},
	// A bare `RESEND_API_KEY=` in .env.local reaches this as "", which is
	// *present* — so an `.optional()` schema rejects it for being too short
	// instead of falling back to undefined. Every optional variable in
	// .env.example is written that way, so without this the app won't boot from
	// a fresh copy of the example file.
	emptyStringAsUndefined: true,
})
