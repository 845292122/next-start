import { defineConfig, devices } from '@playwright/test'

/** Where e2e/auth.setup.ts parks the signed-in cookies. Gitignored. */
export const STORAGE_STATE = './e2e/.auth/user.json'

export default defineConfig({
	testDir: './e2e',
	// *.e2e.ts, not the default *.spec.ts — Bun's test runner also globs
	// **/*.spec.ts project-wide, and the two runners' `test()` globals collide.
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:3000',
		// The app is Chinese-only; pinning the browser's locale keeps the test
		// environment's Accept-Language from introducing incidental differences
		// (Chrome's default is en-US).
		locale: 'zh-CN',
	},
	webServer: {
		// The database has to be fully rebuilt before `next start` binds the port —
		// Playwright only waits on the `url` health check below, so a separate
		// globalSetup racing this command has no ordering guarantee.
		command: 'bun run db:reset && bun run build && bun run start',
		url: 'http://localhost:3000',
		reuseExistingServer: false,
		timeout: 180_000,
		// db:reset deletes whatever DATABASE_URL points at. Overriding it here is
		// what keeps `bun run test:e2e` from wiping the development database — the
		// app and the reset script both read this value.
		//
		// The spread is required: `env` *replaces* the environment rather than
		// extending it, so without it AUTH_SECRET (and PATH) go missing and the
		// build fails on env validation before the server ever binds.
		env: { ...process.env, DATABASE_URL: './data/e2e.db' },
	},
	projects: [
		// Signs in once and saves the cookies; every other project reuses them.
		// Without this each test would have to log in through the form.
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			// One browser project: the shell is a fixed-width icon rail with no
			// responsive breakpoint, so there's nothing a second viewport would cover.
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
			dependencies: ['setup'],
		},
	],
})
