import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconFileSearch } from '@tabler/icons-react'
import { ButtonLink } from '@/components/ui/ButtonLink'

/**
 * Rendered for unmatched URLs and for notFound() thrown anywhere.
 *
 * It sits outside the (app) group, so it gets no rail — and deliberately so:
 * bringing AppShell in here would require a session, and a 404 has to render for
 * signed-out visitors too.
 */
export default function NotFound() {
	return (
		<Center mih="100dvh" p="lg">
			<Stack align="center" gap="md" maw={400} ta="center">
				<ThemeIcon color="gray" variant="light" size={72} radius="xl">
					<IconFileSearch size={36} />
				</ThemeIcon>
				<Title order={1}>404</Title>
				<Text c="dimmed">
					这个地址没有对应的页面。检查一下链接，或者回到首页重新开始。
				</Text>
				<ButtonLink href="/" replace variant="default">
					回到首页
				</ButtonLink>
			</Stack>
		</Center>
	)
}
