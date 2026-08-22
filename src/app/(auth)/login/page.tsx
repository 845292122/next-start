import { Box, Center, Flex } from '@mantine/core'
import { LoginHero } from '@/components/ui/LoginHero'
import { LoginForm } from '@/features/auth/components/LoginForm'

/**
 * Sign-in screen: full-bleed split — decorative panel on the left half, phone +
 * verification-code form on the right — with no card around it.
 *
 * A Server Component: only the form needs client state, and it's its own component
 * for exactly that reason.
 */
export default function LoginPage() {
	return (
		// 100dvh, not 100vh: mobile browser chrome would otherwise push the form past
		// the bottom of the screen.
		<Flex mih="100dvh" align="stretch">
			{/*
			 * Dropped below Mantine's `sm` (48em / 768px) — the form is the point on a
			 * phone. `visibleFrom` is a class Mantine ships for exactly this, so the
			 * breakpoint stays in the theme rather than in a media query here.
			 */}
			<Box flex={1} m="lg" display="flex" visibleFrom="sm">
				<LoginHero />
			</Box>

			<Center flex={1} px="lg" py="xl">
				<Box w="100%" maw={390}>
					<LoginForm />
				</Box>
			</Center>
		</Flex>
	)
}
