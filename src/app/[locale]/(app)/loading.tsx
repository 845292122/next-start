import { Center, Loader } from '@mantine/core'

/**
 * Suspense fallback for the (app) group.
 *
 * Every page in this group is dynamic (each one reads the session), so without a
 * boundary here a navigation shows nothing at all until the server responds.
 * Because this file sits inside `(app)/layout.tsx`, the rail is already painted
 * and only the content area swaps — which is also why it doesn't need to fill the
 * viewport.
 *
 * A Server Component: there's no interactivity, so there's no reason to ship it to
 * the browser. (`Loader` itself is a Client Component — every Mantine export is —
 * but a static one with no props from here, so it costs one boundary and no
 * state.)
 */
export default function AppGroupLoading() {
	return (
		<Center mih="60vh" p="md">
			<Loader />
		</Center>
	)
}
