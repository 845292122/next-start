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
		LOG_LEVEL: z
			.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
			.default('info'),
		RESEND_API_KEY: z.string().min(1).optional(),
	},
	client: {},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		DATABASE_URL: process.env.DATABASE_URL,
		AUTH_SECRET: process.env.AUTH_SECRET,
		LOG_LEVEL: process.env.LOG_LEVEL,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
	},
	// A bare `RESEND_API_KEY=` in .env.local reaches this as "", which is
	// *present* — so an `.optional()` schema rejects it for being too short
	// instead of falling back to undefined. Every optional variable in
	// .env.example is written that way, so without this the app won't boot from
	// a fresh copy of the example file.
	emptyStringAsUndefined: true,
})
