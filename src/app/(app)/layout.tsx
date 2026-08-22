import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { auth } from '@/core/auth'

/**
 * Every route in this group renders inside the rail shell, and requires a
 * session.
 *
 * This is the only route guard in the app: src/proxy.ts deliberately stays
 * auth-free — pulling auth() into it would drag the database driver and the
 * Auth.js adapter into the proxy bundle.
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
		redirect('/login')
	}

	return <AppShell>{children}</AppShell>
}
