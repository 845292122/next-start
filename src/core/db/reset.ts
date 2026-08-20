import { rmSync } from 'node:fs'
import { env } from '@/core/env'

/**
 * `bun run db:reset` — drop, migrate, seed.
 *
 * Deleting the file is the whole "drop database" step; SQLite has no server to
 * ask. There is no confirmation prompt and no equivalent of Prisma's built-in
 * guard against AI agents running destructive commands, so whatever
 * DATABASE_URL points at is gone. Point it at a throwaway path (the e2e run
 * does — see playwright.config.ts) rather than your dev data.
 *
 * The -wal and -shm sidecars have to go too: libsql runs the database in WAL
 * mode, and leaving a WAL behind next to a deleted database makes the next open
 * fail.
 */
if (env.DATABASE_URL === ':memory:') {
	throw new Error('db:reset is pointless against :memory:')
}

for (const suffix of ['', '-wal', '-shm']) {
	rmSync(`${env.DATABASE_URL}${suffix}`, { force: true })
}

// Imported after the delete, and dynamically: core/db/client.ts opens the
// database at import time, so a static import would be hoisted above the rmSync
// and recreate the file before it was removed.
const { runMigrations } = await import('@/core/db/migrate')
await runMigrations()
await import('@/core/db/seed')
