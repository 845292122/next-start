import { sql } from 'drizzle-orm'
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core'

/**
 * Table definitions. This file *is* the schema — there is no .prisma file and
 * nothing is code-generated; `drizzle-kit generate` diffs this against
 * drizzle/meta/ and writes the migration SQL.
 *
 * The first four tables are the shape @auth/drizzle-adapter queries. Their
 * column names and the compound primary keys are fixed by the adapter (see
 * node_modules/@auth/drizzle-adapter/src/lib/sqlite.ts) — don't rename them.
 *
 * There is deliberately no `authenticator` table: it's only needed for WebAuthn,
 * which this template doesn't use.
 */

export const usersTable = sqliteTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	// Kept even though the phone-otp provider never reads it: the adapter's
	// DefaultSQLiteUsersTable contract expects an email column, and it's where a
	// future OAuth provider (WeChat, say) would link an account.
	email: text('email').unique(),
	// timestamp_ms, not timestamp: the adapter writes and reads milliseconds.
	// Getting the unit wrong here dates every verification to 1970.
	emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
	image: text('image'),
	// The actual sign-in identity — see core/auth/otp.ts.
	phone: text('phone').unique(),
})

export const accountsTable = sqliteTable(
	'account',
	{
		userId: text('userId')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		// Stays an integer rather than becoming a timestamp: this is the raw
		// unix-seconds `expires_at` an OAuth provider returns in its token
		// response.
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state'),
	},
	(table) => [
		primaryKey({ columns: [table.provider, table.providerAccountId] }),
	],
)

export const sessionsTable = sqliteTable('session', {
	sessionToken: text('sessionToken').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => usersTable.id, { onDelete: 'cascade' }),
	expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
})

export const verificationTokensTable = sqliteTable(
	'verificationToken',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

export const notesTable = sqliteTable(
	'note',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('userId')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		// SQLite has no boolean type; mode: 'boolean' maps 0/1 to a real boolean
		// on the way in and out.
		done: integer('done', { mode: 'boolean' }).notNull().default(false),
		// mode: 'timestamp' is unix *seconds*, matching unixepoch(). Reads come
		// back as a Date. This one is ours to choose, unlike the auth tables
		// above.
		createdAt: integer('createdAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [index('note_userId_idx').on(table.userId)],
)

/** Row types are inferred, never hand-written. */
export type Note = typeof notesTable.$inferSelect
export type User = typeof usersTable.$inferSelect
