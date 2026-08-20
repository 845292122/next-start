import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from '@/core/db/client'

const MIGRATIONS_FOLDER = './drizzle'

/**
 * Applies every unapplied migration in drizzle/. Exported as a function rather
 * than run at import time so the unit tests can call it against their in-memory
 * database — Prisma had no programmatic equivalent, which is why the equivalent
 * test suite in the sibling template had to shell out to the CLI.
 */
export async function runMigrations() {
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

// `bun run db:migrate` executes this file directly; importing it from a test
// must not re-run the migration as a side effect.
if (import.meta.main) {
	await runMigrations()
	console.log('migrations applied')
}
