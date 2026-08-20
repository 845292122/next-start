import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { auth } from '@/core/auth'
import { redirect } from '@/i18n/navigation'

/**
 * Every route in this group renders inside the rail shell, and requires a
 * session.
 *
 * This is the only route guard in the app: src/proxy.ts deliberately stays a
 * pure next-intl middleware — pulling auth() into it would drag the database
 * driver and the Auth.js adapter into the proxy bundle.
 *
 * A layout guard does *not* cover src/app/api/ (route handlers don't run
 * layouts), which is why every handler there still checks the session itself.
 */
export default async function AppGroupLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const session = await auth()

	if (!session?.user) {
		// redirect() from @/i18n/navigation needs the locale explicitly so the
		// target keeps its prefix (/en/login rather than /login).
		redirect({ href: '/login', locale: await getLocale() })
	}

	return <AppShell>{children}</AppShell>
}
