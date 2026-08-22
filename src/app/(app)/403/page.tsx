import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { ButtonLink } from '@/components/ui/ButtonLink'

/**
 * Nothing redirects here yet: the (app) layout's guard covers "not signed in",
 * and there is no role model to fail. This is the page a role check should send an
 * authenticated-but-unauthorized user to.
 */
export default function NoPermission() {
	return (
		<Center mih="60vh" p="lg">
			<Stack align="center" gap="md" maw={400} ta="center">
				<ThemeIcon color="red" variant="light" size={72} radius="xl">
					<IconLock size={36} />
				</ThemeIcon>
				<Title order={1}>403</Title>
				<Text c="dimmed">
					你的账号没有这个页面的访问权限。需要的话找管理员开通。
				</Text>
				{/*
				 * A Client Component wrapper, because `component={Link}` can't be
				 * written from a Server Component — see components/ui/ButtonLink.tsx.
				 */}
				<ButtonLink href="/" replace variant="default">
					回到首页
				</ButtonLink>
			</Stack>
		</Center>
	)
}
