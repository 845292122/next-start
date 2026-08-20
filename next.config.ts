import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

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
}

export default withNextIntl(nextConfig)
