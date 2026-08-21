import { runMigrations } from '@/core/db/migrate'

/**
 * Standalone entry point for applying migrations, for environments that have
 * neither Bun nor the TypeScript sources — the Docker runtime image, above all.
 *
 * `bun run db:migrate` executes `migrate.ts` directly and relies on
 * `import.meta.main` to decide whether to run. That guard is **not** portable:
 * it's a Bun feature, and Node only grew `import.meta.main` in v24, so a bundle of
 * `migrate.ts` built for Node would silently apply nothing on Node 20 or 22 — the
 * versions `engines` actually allows. A dedicated entry with a top-level call has
 * no such ambiguity.
 *
 * The Dockerfile bundles this with:
 *
 * ```
 * bun build src/core/db/migrate-cli.ts --target=node \\
 *   --outfile=migrate.mjs --external @libsql/client
 * ```
 *
 * `@libsql/client` stays external for the same reason it's in
 * `serverExternalPackages`: it loads a platform-specific `.node` addon. That means
 * the bundle has to sit somewhere the traced `node_modules` is resolvable from —
 * i.e. inside the standalone output, which is where the Dockerfile puts it.
 *
 * `drizzle/` has to be present relative to the working directory too, since
 * `migrate.ts` reads its SQL from `./drizzle`.
 */
await runMigrations()
console.log('migrations applied')
