/**
 * Points the unit tests at a throwaway in-memory database, before anything else
 * in the process gets a chance to read the real one.
 *
 * Loaded via `--preload` in the `test:unit` script rather than set inside each
 * test file, because per-file assignment can't actually work once more than one
 * suite is involved:
 *
 * `core/env.ts` validates `process.env` at **module scope** and every consumer
 * reads the resulting frozen `env` object — `core/db/client.ts` opens
 * `env.DATABASE_URL`, not `process.env.DATABASE_URL`. So the first module in the
 * process to pull in `@/core/env` (transitively: anything importing
 * `core/logger.ts`, which is most of `core/`) decides what `DATABASE_URL` is for
 * every suite that runs afterwards. A `process.env.DATABASE_URL = ':memory:'` at
 * the top of one test file is already too late if a *different* file loaded
 * `core/logger.ts` first — and since `bun test` runs every file in one process,
 * which file that is comes down to traversal order.
 *
 * The symptom when this goes wrong is quiet and nasty: the suite runs against
 * `./data/dev.db`, appears to pass, and then fails on the *next* run with a
 * UNIQUE constraint violation from the rows it left behind.
 *
 * A preload runs before any test file is evaluated, which is the one ordering
 * that's actually guaranteed.
 */
process.env.DATABASE_URL = ':memory:'
