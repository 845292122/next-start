import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { buildStaticSecurityHeaders } from './src/core/security-headers'

const withNextIntl = createNextIntlPlugin({
	// Given explicitly rather than relying on the plugin's src/ auto-detection.
	requestConfig: './src/i18n/request.ts',
	experimental: {
		// Generates src/i18n/messages/zh.d.json.ts, which src/types/messages.d.ts
		// feeds into next-intl's AppConfig so t() keys are typechecked. The
		// generated file is committed: it's only written during next dev/build,
		// and `bun run typecheck` doesn't trigger it.
		createMessagesDeclaration: './src/i18n/messages/zh.json',
	},
})

const nextConfig: NextConfig = {
	// @libsql/client loads a platform-specific native addon (@libsql/darwin-arm64
	// and friends). Bundling it would leave the .node binary behind, so it has to
	// stay an external require() at runtime.
	serverExternalPackages: ['@libsql/client'],

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

export default withNextIntl(nextConfig)
