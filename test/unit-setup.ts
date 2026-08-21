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

/**
 * Silences the wrappers' own warn/error output.
 *
 * Here rather than in the test files that care, for exactly the reason above:
 * `core/logger.ts` reads the level off the frozen `env` object, so the first
 * module to pull in `@/core/env` decides it for the whole process. Setting it at
 * the top of `core/http.test.ts` worked only until another file — `site-url.test.ts`
 * as it happens — imported env first, at which point the suite started dumping
 * every logged failure to the console.
 *
 * `fatal` is the highest level in core/env.ts's enum, so warn and error are both
 * suppressed. Raise it temporarily if you're debugging what a wrapper logged.
 */
process.env.LOG_LEVEL = 'fatal'
