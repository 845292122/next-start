import type { MetadataRoute } from 'next'

/**
 * Served at /manifest.webmanifest — what a browser reads when the app is
 * installed to a home screen or pinned.
 *
 * `dynamic = 'force-static'` because this has no request-time inputs and Next
 * would otherwise have to render it per request.
 *
 * No `icons` entry: this template ships only `favicon.ico`, and listing icon
 * sizes that don't exist makes installation fail rather than degrade. Add real
 * 192×192 and 512×512 PNGs (see Next's app-icons file conventions) and then list
 * them here.
 */
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'Next Start',
		short_name: 'Next Start',
		description: '全栈 Next.js 项目模板',
		lang: 'zh',
		start_url: '/',
		display: 'standalone',
		// Matches the light theme's --background / --accent in globals.css. These are
		// literals because a manifest can't read CSS variables; if you retheme, update
		// them here too.
		background_color: '#f7f7f7',
		theme_color: '#000000',
	}
}
