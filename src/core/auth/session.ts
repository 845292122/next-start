import { auth } from '@/core/auth'

export async function getRequiredSession() {
	const session = await auth()
	if (!session?.user) throw new Error('unauthorized')
	return session
}
