'use client'

import {
	Card,
	Container,
	Divider,
	Group,
	SegmentedControl,
	Stack,
	Switch,
	Text,
	Title,
} from '@mantine/core'
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import { type ThemeMode, useColorMode } from '@/components/ui/color-mode'

const NOTIFICATIONS = [
	{ key: 'buildDone', label: '构建完成时通知我' },
	{ key: 'deployFailed', label: '部署失败时通知我' },
	{ key: 'weeklyDigest', label: '每周汇总邮件' },
] as const

/** Placeholder page — copy this file as the starting point for a new one. */
export default function Settings() {
	const { mode, setMode, colorMode } = useColorMode()

	return (
		<Container size="sm" py={{ base: 'md', sm: 'xl' }}>
			<Stack gap="xl">
				<div>
					<Title order={2}>设置</Title>
					<Text size="sm" c="dimmed" mt={4}>
						占位页面。新增页面：在 src/app/(app) 下建目录，然后到
						src/components/layout/NavLinks.ts 加一条导航项。
					</Text>
				</div>

				{/* Colour scheme: three states (follow the OS / light / dark) */}
				<Card withBorder padding="lg" radius="md">
					<Text fw={600}>外观</Text>
					<Text size="xs" c="dimmed">
						当前生效：{colorMode === 'dark' ? '深色' : '浅色'}
						{mode === 'auto' ? '（跟随系统）' : ''}
					</Text>
					<Divider my="md" />
					{/*
					 * `data` with `label: <Group>` — a SegmentedControl item's label takes
					 * any node, so the icon needs no separate slot. The value type is
					 * `ThemeMode` rather than string, which is what keeps `setMode` from
					 * needing a cast.
					 */}
					<SegmentedControl<ThemeMode>
						fullWidth
						value={mode}
						onChange={setMode}
						data={[
							{
								value: 'auto',
								label: (
									<Group gap={6} justify="center" wrap="nowrap">
										<IconDeviceDesktop size={16} />
										跟随系统
									</Group>
								),
							},
							{
								value: 'light',
								label: (
									<Group gap={6} justify="center" wrap="nowrap">
										<IconSun size={16} />
										浅色
									</Group>
								),
							},
							{
								value: 'dark',
								label: (
									<Group gap={6} justify="center" wrap="nowrap">
										<IconMoon size={16} />
										深色
									</Group>
								),
							},
						]}
					/>
				</Card>

				<Card withBorder padding="lg" radius="md">
					<Text fw={600}>通知</Text>
					<Text size="xs" c="dimmed">
						占位开关，接上你自己的偏好存储即可
					</Text>
					<Divider my="md" />
					<Stack gap="sm">
						{NOTIFICATIONS.map(({ key, label }) => (
							<Switch
								key={key}
								label={label}
								defaultChecked={key !== 'weeklyDigest'}
							/>
						))}
					</Stack>
				</Card>
			</Stack>
		</Container>
	)
}
