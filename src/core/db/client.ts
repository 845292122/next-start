import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '@/core/db/schema'
import { env } from '@/core/env'

/**
 * @libsql/client rather than better-sqlite3, which is the more common Node
 * choice: better-sqlite3's N-API addon crashes Bun's runtime outright
 * (`NAPI FATAL ERROR` panic), and this project runs the seed, the migrator and
 * `bun test` under Bun while Next runs the app itself under Node. libsql is the
 * only driver that works under both. It also means `file:` URLs and a Turso
 * connection string are drop-in alternatives to a local path.
 */
function createDb() {
	const url = toLibsqlUrl(env.DATABASE_URL)

	if (url.startsWith('file:')) {
		// The driver creates the database file but not its parent directory, and
		// a fresh clone has no data/ — it's gitignored.
		mkdirSync(dirname(url.slice('file:'.length)), { recursive: true })
	}

	// No `PRAGMA foreign_keys = ON` here on purpose: libsql enables foreign keys
	// by default, unlike bare SQLite (and unlike better-sqlite3), so every
	// `onDelete: 'cascade'` in schema.ts is live. Verified — don't "fix" this by
	// adding the pragma back and assuming it was missing.
	return drizzle(createClient({ url }), { schema })
}

/**
 * DATABASE_URL is written as a plain filesystem path so that drizzle-kit can
 * use the same value, but libsql requires a scheme. In-memory stays as-is:
 * libsql understands `:memory:`.
 */
function toLibsqlUrl(databaseUrl: string) {
	// `file::memory:?cache=shared`, not the bare `:memory:` libsql also accepts.
	//
	// A plain in-memory database is **private to one connection**, and
	// @libsql/client opens a second connection for `db.transaction()`. The result is
	// that any transaction against `:memory:` sees an empty database and leaves the
	// original connection unusable — verified: a commit-only transaction is enough,
	// and afterwards every query fails with `no such table`. Since the unit suite
	// runs on in-memory (test/unit-setup.ts) while production runs on a file, that
	// divergence would mean transactions could not be tested at all.
	//
	// The shared-cache URI is SQLite's answer to exactly this: one in-memory
	// database, reachable from every connection in the process. Same speed, no
	// per-connection isolation.
	if (databaseUrl === ':memory:') return 'file::memory:?cache=shared'
	if (/^(file|libsql|https?|wss?):/.test(databaseUrl)) return databaseUrl
	return `file:${databaseUrl}`
}

// Next re-evaluates this module on every dev HMR pass, and again in each of its
// parallel build workers. Without the globalThis cache every evaluation would
// open another handle on the database file and leak it.
const globalForDb = globalThis as unknown as {
	db?: ReturnType<typeof createDb>
}

globalForDb.db ??= createDb()

export const db = globalForDb.db
