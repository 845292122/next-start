'use client'

import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Code,
	Container,
	Divider,
	Group,
	Progress,
	SegmentedControl,
	SimpleGrid,
	Slider,
	Stack,
	Switch,
	Text,
	TextInput,
	Title,
	Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
	BellIcon,
	type Icon,
	InfoIcon,
	LightningIcon,
	PaletteIcon,
	StackIcon,
} from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * Dashboard — doubles as living documentation for the design system. Delete the
 * whole page when real features land; nothing else depends on it.
 *
 * Layout is Mantine's own: `Stack` / `Group` / `SimpleGrid` and the size props on
 * each component. There are no utility classes anywhere in this project.
 */

function StatCard({
	label,
	value,
	hint,
	icon: StatIcon,
}: {
	label: string
	value: string
	hint: string
	icon: Icon
}) {
	return (
		<Card withBorder padding="lg" radius="md">
			<Group justify="space-between" align="flex-start" mb="xs">
				<Text size="sm" fw={600} c="dimmed">
					{label}
				</Text>
				<StatIcon size={18} color="var(--mantine-primary-color-filled)" />
			</Group>
			<Text fz={28} fw={700} lh={1.2}>
				{value}
			</Text>
			<Text size="xs" c="dimmed" mt={4}>
				{hint}
			</Text>
		</Card>
	)
}

/** Section shell: title + note + divider. */
function Section({
	title,
	note,
	children,
}: {
	title: string
	note: string
	children: React.ReactNode
}) {
	return (
		<Card withBorder padding="lg" radius="md" h="100%">
			<Text fw={600}>{title}</Text>
			<Text size="xs" c="dimmed">
				{note}
			</Text>
			<Divider my="md" />
			{children}
		</Card>
	)
}

/**
 * A Mantine colour is a 10-step scale, and every component variant is derived from
 * it — this is the counterpart to a semantic-token system where each role is a
 * separate variable. `theme.primaryColor` decides which scale the whole UI leans
 * on.
 */
const SHADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/**
 * The colours this app uses for meaning. Mantine ships no `success` / `danger`
 * aliases: you pick scales and use them consistently, so the mapping lives in one
 * place like this rather than being re-decided per component.
 */
const ROLES = ['blue', 'teal', 'yellow', 'red', 'gray'] as const

export default function Dashboard() {
	const t = useTranslations('Dashboard')
	const [density, setDensity] = useState('comfortable')
	const [notify, setNotify] = useState(true)
	const [volume, setVolume] = useState(40)

	return (
		<Container size="xl" py={{ base: 'md', sm: 'xl' }}>
			{/* Header */}
			<Stack gap={4} mb="xl">
				<Text size="sm" fw={600} c="var(--mantine-primary-color-filled)">
					{t('eyebrow')}
				</Text>
				<Title order={1} fz={30}>
					{t('title')}
				</Title>
				<Text c="dimmed" maw={560}>
					{/* t.rich, not t: the message wraps the file path in <code> */}
					{t.rich('description', {
						code: (chunks) => <Code>{chunks}</Code>,
					})}
				</Text>
			</Stack>

			<Stack gap="md">
				{/* Stat cards */}
				<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
					<StatCard
						label={t('stats.layout.label')}
						value={t('stats.layout.value')}
						hint={t('stats.layout.hint')}
						icon={StackIcon}
					/>
					<StatCard
						label={t('stats.theme.label')}
						value={t('stats.theme.value')}
						hint={t('stats.theme.hint')}
						icon={PaletteIcon}
					/>
					<StatCard
						label={t('stats.platform.label')}
						value={t('stats.platform.value')}
						hint={t('stats.platform.hint')}
						icon={LightningIcon}
					/>
				</SimpleGrid>

				{/* Colour scales */}
				<Section title={t('palette.title')} note={t('palette.note')}>
					<Stack gap="md">
						<Group gap={0} wrap="nowrap">
							{SHADES.map((shade) => (
								<Box
									key={shade}
									flex={1}
									h={44}
									bg={`var(--mantine-primary-color-${shade})`}
									// The scale reads left-to-right as light→dark, so the label
									// has to flip contrast halfway or the last swatches go
									// unreadable. 4 is Mantine's own crossover point.
									c={shade > 4 ? 'white' : 'black'}
									fz={10}
									ta="center"
									style={{ lineHeight: '44px' }}
								>
									{shade}
								</Box>
							))}
						</Group>
						<SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
							{ROLES.map((role) => (
								/*
								 * The `light` pair rather than `filled` + a hand-picked
								 * foreground: each scale ships `-light` with a matching
								 * `-light-color`, so one variable pair covers both schemes and
								 * no swatch needs a contrast decision here. Two of these pairs
								 * are adjusted in the theme's `cssVariablesResolver` because
								 * Mantine's own values don't clear WCAG AA — the note there has
								 * the measurements.
								 */
								<Box
									key={role}
									h={44}
									bg={`var(--mantine-color-${role}-light)`}
									c={`var(--mantine-color-${role}-light-color)`}
									fz="xs"
									fw={500}
									display="flex"
									style={{
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: 'var(--mantine-radius-md)',
									}}
								>
									{role}
								</Box>
							))}
						</SimpleGrid>
					</Stack>
				</Section>

				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
					{/* Buttons */}
					<Section title={t('buttons.title')} note={t('buttons.note')}>
						<Stack gap="sm">
							<Group gap="xs">
								<Button size="xs">Filled</Button>
								<Button size="xs" variant="light">
									Light
								</Button>
								<Button size="xs" variant="outline">
									Outline
								</Button>
							</Group>
							<Group gap="xs">
								<Button size="xs" variant="subtle">
									Subtle
								</Button>
								<Button size="xs" variant="default">
									Default
								</Button>
								<Button size="xs" color="red">
									Danger
								</Button>
								<Button size="xs" disabled>
									Disabled
								</Button>
							</Group>
						</Stack>
					</Section>

					{/* Badges and notifications */}
					<Section title={t('chips.title')} note={t('chips.note')}>
						<Stack gap="md">
							<Group gap="xs">
								<Badge>{t('chips.default')}</Badge>
								<Badge color="teal">{t('chips.live')}</Badge>
								<Badge color="red" variant="light">
									{t('chips.buildFailed')}
								</Badge>
								<Badge color="yellow" variant="light">
									{t('chips.archived')}
								</Badge>
							</Group>
							<Group gap="xs">
								<Button
									size="xs"
									variant="light"
									leftSection={<BellIcon size={16} />}
									onClick={() =>
										notifications.show({
											color: 'teal',
											message: t('chips.toastSuccess'),
										})
									}
								>
									{t('chips.toastTrigger')}
								</Button>
								<Button
									size="xs"
									variant="light"
									color="red"
									onClick={() =>
										notifications.show({
											color: 'red',
											message: t('chips.toastDanger'),
										})
									}
								>
									{t('chips.toastDangerTrigger')}
								</Button>
							</Group>
						</Stack>
					</Section>
				</SimpleGrid>

				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
					{/* Form controls */}
					<Section title={t('form.title')} note={t('form.note')}>
						<Stack gap="md">
							<TextInput
								label={t('form.projectName')}
								defaultValue="acme-console"
								placeholder="acme-console"
							/>
							<TextInput
								label={t('form.remark')}
								placeholder={t('form.remarkPlaceholder')}
							/>
							<Switch
								label={t('form.notify')}
								checked={notify}
								onChange={(event) => setNotify(event.currentTarget.checked)}
							/>
						</Stack>
					</Section>

					{/* Selection and progress */}
					<Section title={t('controls.title')} note={t('controls.note')}>
						<Stack gap="lg">
							{/*
							 * One component with a `data` array, where the react-aria original
							 * needed a group plus one child per option and a Set for the
							 * selection. Renders as a radiogroup.
							 */}
							<SegmentedControl
								fullWidth
								value={density}
								onChange={setDensity}
								data={[
									{ value: 'compact', label: t('controls.compact') },
									{ value: 'comfortable', label: t('controls.comfortable') },
									{ value: 'spacious', label: t('controls.spacious') },
								]}
							/>

							<div>
								<Text size="sm" mb="xs">
									{t('controls.volume', { value: volume })}
								</Text>
								{/*
								 * thumbLabel, not aria-label: the thumb is the element carrying
								 * role="slider", so that's where the accessible name has to
								 * land. Caught by e2e/a11y.e2e.ts otherwise.
								 */}
								<Slider
									value={volume}
									onChange={setVolume}
									thumbLabel={t('controls.volumeLabel')}
								/>
							</div>

							<div>
								<Text size="sm" mb="xs">
									{t('controls.buildProgress')}
								</Text>
								{/* Same reasoning: Progress forwards aria-label to its inner
								    section, which is what has role="progressbar". */}
								<Progress value={72} aria-label={t('controls.buildProgress')} />
							</div>
						</Stack>
					</Section>
				</SimpleGrid>

				{/* Alerts and tooltips */}
				<Section title={t('surfaces.title')} note={t('surfaces.note')}>
					<Stack gap="md">
						{ROLES.map((role) => (
							<Alert
								key={role}
								color={role}
								variant="light"
								icon={<InfoIcon size={18} />}
								title={t('surfaces.alertTitle', { status: role })}
							>
								{t('surfaces.alertBody')}
							</Alert>
						))}
						<Group gap="xs">
							<Tooltip
								label={t('surfaces.tooltipBody')}
								withArrow
								openDelay={200}
							>
								<Button size="xs" variant="outline">
									{t('surfaces.tooltipTrigger')}
								</Button>
							</Tooltip>
						</Group>
					</Stack>
				</Section>
			</Stack>
		</Container>
	)
}
