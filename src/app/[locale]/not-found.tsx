import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconFileSearch } from '@tabler/icons-react'
import { getTranslations } from 'next-intl/server'
import { ButtonLink } from '@/components/ui/ButtonLink'

/**
 * Rendered for unmatched URLs (via app/[locale]/[...rest]/page.tsx) and for
 * notFound() thrown in this segment.
 *
 * It sits outside the (app) group, so it gets no rail — and deliberately so:
 * bringing AppShell in here would require a session, and a 404 has to render for
 * signed-out visitors too.
 */
export default async function NotFound() {
	const t = await getTranslations('Errors')

	return (
		<Center mih="100dvh" p="lg">
			<Stack align="center" gap="md" maw={400} ta="center">
				<ThemeIcon color="gray" variant="light" size={72} radius="xl">
					<IconFileSearch size={36} />
				</ThemeIcon>
				<Title order={1}>404</Title>
				<Text c="dimmed">{t('notFound')}</Text>
				<ButtonLink href="/" replace variant="default">
					{t('backHome')}
				</ButtonLink>
			</Stack>
		</Center>
	)
}
