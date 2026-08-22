'use client'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { cssVariablesResolver } from '@/components/providers/css-variables-resolver'
import { theme } from '@/components/providers/theme'

/**
 * Every client-side provider the app needs, in one place.
 *
 * Shorter than it looks like it should be, because Mantine concentrates what
 * other kits spread out: `MantineProvider` carries the theme, the colour scheme
 * and the CSS variables, and there is no router provider to wire — Mantine
 * components take `component={Link}` per call site rather than resolving
 * navigation through context.
 */
export function AppProviders({
	children,
	session,
	nonce,
}: {
	children: React.ReactNode
	session: Session | null
	/**
	 * The CSP nonce, read from the request by `app/layout.tsx`.
	 *
	 * Used for the `<style>` element `MantineProvider` generates to hold the
	 * theme's CSS variables. Everything Next itself emits gets a nonce
	 * automatically; this element is created by Mantine, so it has to be told.
	 */
	nonce?: string
}) {
	return (
		<SessionProvider session={session}>
			{/*
			 * defaultColorScheme="auto" — follow the OS until the user picks
			 * otherwise. It has to match the value given to `<ColorSchemeScript>` in
			 * app/layout.tsx: the script decides what the page paints with
			 * *before* React runs, so a mismatch is a flash of the wrong scheme
			 * followed by a correction.
			 */}
			<MantineProvider
				theme={theme}
				defaultColorScheme="auto"
				cssVariablesResolver={cssVariablesResolver}
				/*
				 * Note this has no effect under the *current* policy: `style-src` keeps
				 * `'unsafe-inline'` (see core/security-headers.ts on why Mantine's
				 * inline `style` attributes leave no alternative), and per the CSP spec
				 * a directive holding a nonce ignores `'unsafe-inline'`, not the other
				 * way round. It's here so that tightening `style-src` to nonce-only
				 * stays a one-line change in that file, with our own styles already
				 * compliant.
				 */
				getStyleNonce={nonce ? () => nonce : undefined}
			>
				{/*
				 * Not a provider despite living here — it's the component that renders
				 * the notification stack, and `notifications.show()` reaches it through
				 * a module-level store. Exactly one may be mounted; a second one
				 * renders every notification twice.
				 */}
				<Notifications position="bottom-right" />
				{children}
			</MantineProvider>
		</SessionProvider>
	)
}
