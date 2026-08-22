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
import { useTranslations } from 'next-intl'
import { type ThemeMode, useColorMode } from '@/components/ui/color-mode'

/** Placeholder page — copy this file as the starting point for a new one. */
export default function Settings() {
	const t = useTranslations('Settings')
	const { mode, setMode, colorMode } = useColorMode()

	return (
		<Container size="sm" py={{ base: 'md', sm: 'xl' }}>
			<Stack gap="xl">
				<div>
					<Title order={2}>{t('title')}</Title>
					<Text size="sm" c="dimmed" mt={4}>
						{t('description')}
					</Text>
				</div>

				{/* Colour scheme: three states (follow the OS / light / dark) */}
				<Card withBorder padding="lg" radius="md">
					<Text fw={600}>{t('appearance.title')}</Text>
					<Text size="xs" c="dimmed">
						{t('appearance.current', {
							mode:
								colorMode === 'dark'
									? t('appearance.dark')
									: t('appearance.light'),
						})}
						{mode === 'auto' ? t('appearance.followingSystem') : ''}
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
										{t('appearance.system')}
									</Group>
								),
							},
							{
								value: 'light',
								label: (
									<Group gap={6} justify="center" wrap="nowrap">
										<IconSun size={16} />
										{t('appearance.light')}
									</Group>
								),
							},
							{
								value: 'dark',
								label: (
									<Group gap={6} justify="center" wrap="nowrap">
										<IconMoon size={16} />
										{t('appearance.dark')}
									</Group>
								),
							},
						]}
					/>
				</Card>

				<Card withBorder padding="lg" radius="md">
					<Text fw={600}>{t('notifications.title')}</Text>
					<Text size="xs" c="dimmed">
						{t('notifications.note')}
					</Text>
					<Divider my="md" />
					<Stack gap="sm">
						{(['buildDone', 'deployFailed', 'weeklyDigest'] as const).map(
							(key) => (
								<Switch
									key={key}
									label={t(`notifications.${key}`)}
									defaultChecked={key !== 'weeklyDigest'}
								/>
							),
						)}
					</Stack>
				</Card>
			</Stack>
		</Container>
	)
}
