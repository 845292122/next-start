import type { NextConfig } from 'next'
import { buildStaticSecurityHeaders } from './src/core/security-headers'

const nextConfig: NextConfig = {
	// @libsql/client loads a platform-specific native addon (@libsql/darwin-arm64
	// and friends). Bundling it would leave the .node binary behind, so it has to
	// stay an external require() at runtime.
	serverExternalPackages: ['@libsql/client'],

	/**
	 * Emits `.next/standalone/`, a self-contained server that runs with
	 * `node server.js` and no `node_modules` install. That's what makes the
	 * Dockerfile's runtime stage small, and it's the reason the runtime image needs
	 * no package manager at all.
	 *
	 * Two things it does **not** copy, by Next's design — the Dockerfile copies both
	 * by hand, and forgetting either is a silent failure (the app boots and serves
	 * unstyled pages with 404s for every asset):
	 *   - `public/`
	 *   - `.next/static/`
	 *
	 * The `serverExternalPackages` entry above interacts with this: standalone traces
	 * which files to copy, and an external package's native `.node` addon has to be
	 * traced correctly or the server dies at first query. Verified — see
	 * DEVELOPMENT.md § 部署.
	 *
	 * ## Why it's opt-in rather than always on
	 *
	 * `output: 'standalone'` and `next start` are mutually exclusive — Next warns
	 * `"next start" does not work with "output: standalone" configuration`. Leaving it
	 * on unconditionally therefore breaks the two most-used commands in the repo:
	 * `bun run start` (what README tells you to run) and `playwright.config.ts`'s
	 * `webServer`, which builds and then starts.
	 *
	 * So the Dockerfile sets `NEXT_OUTPUT=standalone` and nothing else does. Local and
	 * CI builds stay on the ordinary server; the container build gets the traced
	 * bundle.
	 */
	output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

	experimental: {
		/**
		 * Rewrites `import { Button } from '@mantine/core'` into per-module imports
		 * so a page pulls in only what it uses.
		 *
		 * Not cosmetic for these packages: they are barrel files with hundreds of
		 * re-exports, and without this every module that imports one icon/component
		 * makes the compiler walk the whole barrel on every dev rebuild. Next
		 * optimizes a fixed list of libraries by default — `@tabler/icons-react` is
		 * on it, Mantine is not, hence this entry. See
		 * node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md.
		 */
		optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
	},

	/**
	 * The fixed-value security headers. The Content-Security-Policy is *not* here —
	 * it needs a per-request nonce, so `src/proxy.ts` sets it.
	 *
	 * `process.env.NODE_ENV` directly rather than `@/core/env`: this file is
	 * evaluated by the Next CLI, which has no `AUTH_SECRET` in scope during some
	 * invocations, and `core/env.ts` would reject the whole config over it. Same
	 * reasoning as `drizzle.config.ts`.
	 *
	 * `source: '/(.*)'` on purpose: unlike the proxy — whose matcher excludes
	 * `/api` and static assets — these headers should reach *every* response.
	 * `nosniff` on a JSON API response is one of the places it matters most.
	 */
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: buildStaticSecurityHeaders({
					isDev: process.env.NODE_ENV === 'development',
				}),
			},
		]
	},
}

export default nextConfig
