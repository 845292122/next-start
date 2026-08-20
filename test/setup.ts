import { expect } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

/**
 * DOM setup for component tests. Loaded via `--preload` in the `test:dom`
 * script, not imported from a test file: `@testing-library/dom` captures
 * `document.body` when it is first imported, and a static import inside a test
 * file can't be guaranteed to run after this.
 *
 * Three things here are load-bearing, all learned the hard way:
 *  - register() is async in happy-dom 20. Calling it without await leaves the
 *    globals unset and every query fails with "a global document has to be
 *    available".
 *  - the matchers are imported *dynamically, below the await*. jest-dom's
 *    matchers module pulls in @testing-library/dom, so a static import here
 *    would be hoisted above the registration and hit the same failure.
 *  - they come from the `/matchers` subpath and go in through expect.extend().
 *    The package's default entry is ambient-only — it augments Jest's globals,
 *    which don't exist here, and importing it fails typecheck with
 *    "is not a module".
 */
await GlobalRegistrator.register()

// Bun flattens the `export =` CJS module onto the namespace itself, so the
// matchers *are* the namespace and there is no `.default` to unwrap. TypeScript
// models the same module as having one, though, and expect.extend rejects the
// extra key — hence the cast.
const matchers = await import('@testing-library/jest-dom/matchers')
expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0])
