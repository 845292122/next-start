import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// The drizzle-kit CLI is its own process and doesn't get Bun's automatic .env
// loading, so process.env would be empty here. dotenv doesn't override
// variables that are already set, so an explicit DATABASE_URL (CI, or the
// throwaway database for the e2e run) still wins over the file.
config({ path: ['.env.local', '.env'], quiet: true })

export default defineConfig({
	dialect: 'sqlite',
	// The schema is TypeScript that the app imports directly, so it lives under
	// src/ rather than in a top-level directory of its own.
	schema: './src/core/db/schema.ts',
	// Generated SQL + meta/ — committed, never hand-edited.
	out: './drizzle',
	// Read straight from process.env rather than through @/core/env: the CLI
	// doesn't need AUTH_SECRET, which that schema requires.
	dbCredentials: { url: process.env.DATABASE_URL ?? './data/dev.db' },
})
