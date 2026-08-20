import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

/** "/" has no content of its own — the dashboard is the landing page. */
export default async function Index() {
	// redirect() from @/i18n/navigation needs the locale explicitly so the target
	// keeps its prefix (/en/dashboard rather than /dashboard).
	const locale = await getLocale()
	redirect({ href: '/dashboard', locale })
}
