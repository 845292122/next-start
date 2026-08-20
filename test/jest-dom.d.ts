import type { expect } from 'bun:test'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

/**
 * Teaches bun:test's `expect` about the jest-dom matchers that test/setup.ts
 * registers with expect.extend() — without this, toBeInTheDocument() and friends
 * typecheck as missing.
 *
 * jest-dom ships this exact augmentation at types/bun.d.ts, but that path isn't
 * in the package's exports map, so a `/// <reference types="...">` to it doesn't
 * resolve. Restating it here is the way in.
 */
declare module 'bun:test' {
	interface Matchers<T = unknown>
		extends TestingLibraryMatchers<
			ReturnType<typeof expect.stringContaining>,
			T
		> {}
}
