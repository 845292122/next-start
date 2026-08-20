import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
	locales: ['zh', 'en'],
	defaultLocale: 'zh',
	// as-needed: the default locale carries no prefix, so /dashboard is Chinese
	// and /en/dashboard is English. /zh/dashboard redirects to /dashboard.
	localePrefix: 'as-needed',
})
