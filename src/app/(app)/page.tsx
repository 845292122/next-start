import { redirect } from 'next/navigation'

/** "/" has no content of its own — the dashboard is the landing page. */
export default function Index() {
	redirect('/dashboard')
}
