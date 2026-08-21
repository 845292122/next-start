import { z } from 'zod'

/**
 * Turns off zod's JIT compiler in the browser.
 *
 * Zod 4 compiles object schemas into optimized validators with `new Function`,
 * which a strict CSP counts as `eval`. In the browser that means every
 * `zodResolver` validation trips `script-src` and the schema silently falls back —
 * `e2e/security.e2e.ts` caught this as a `script-src: eval` violation on the login
 * page. Zod's own source acknowledges the interaction: the `jitless` flag exists
 * "for environments that disallow `eval`".
 *
 * The alternative was adding `'unsafe-eval'` to `script-src` in production, which
 * would gut the one directive that actually stops injected script from running.
 * Losing a JIT pass on form validation costs nothing measurable; a form has a
 * handful of fields, not a hot loop.
 *
 * **Server-side JIT is left on** — there's no CSP on the server, and that's where
 * validation volume actually is (every Server Action and Route Handler parse).
 * Hence the `window` check rather than a blanket config.
 *
 * ## Why this is imported from the schema modules
 *
 * `globalConfig.jitless` is read when a schema *parses*, not when it's
 * constructed, so this only has to run before the first parse. Importing it from
 * `core/auth/schema.ts` and `features/notes/schema.ts` guarantees that: any client
 * code that can parse has necessarily loaded the schema module, which loads this
 * one first. **A new schema module used on the client must import this too.**
 */
if (typeof window !== 'undefined') {
	z.config({ jitless: true })
}
