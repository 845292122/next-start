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
	IconBell,
	IconBolt,
	IconInfoCircle,
	IconPalette,
	IconStack,
	type TablerIcon,
} from '@tabler/icons-react'
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
	icon: TablerIcon
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
	const [density, setDensity] = useState('comfortable')
	const [notify, setNotify] = useState(true)
	const [volume, setVolume] = useState(40)

	return (
		<Container size="xl" py={{ base: 'md', sm: 'xl' }}>
			{/* Header */}
			<Stack gap={4} mb="xl">
				<Text size="sm" fw={600} c="var(--mantine-primary-color-filled)">
					Mantine · 主题与组件
				</Text>
				<Title order={1} fz={30}>
					设计系统一览
				</Title>
				<Text c="dimmed" maw={560}>
					这一页把主题里的色阶和常用组件摆出来。Mantine 的主题是一个 JS 对象，改{' '}
					<Code>src/components/providers/theme.ts</Code>{' '}
					就能看到全部组件跟着变。
				</Text>
			</Stack>

			<Stack gap="md">
				{/* Stat cards */}
				<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
					<StatCard
						label="布局"
						value="导航栏"
						hint="侧边栏 + 内容区 + 过渡动画"
						icon={IconStack}
					/>
					<StatCard
						label="主题"
						value="CSS 变量"
						hint="语义色角色，明暗自动适配"
						icon={IconPalette}
					/>
					<StatCard
						label="平台"
						value="Web + SSR"
						hint="服务端组件与客户端组件共用一套样式"
						icon={IconBolt}
					/>
				</SimpleGrid>

				{/* Colour scales */}
				<Section
					title="颜色与色阶"
					note="Mantine 的每个颜色都是 0–9 十级色阶，组件的 variant 从色阶推导；theme.primaryColor 决定整套 UI 用哪一组"
				>
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
					<Section
						title="按钮"
						note="Mantine 的 variant 系统：filled / light / outline / subtle / default，颜色由 color 单独决定"
					>
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
					<Section
						title="标签与消息"
						note="Badge 用于状态展示；notifications.show() 取代了 toast，前提是挂了一个 Notifications 组件"
					>
						<Stack gap="md">
							<Group gap="xs">
								<Badge>默认</Badge>
								<Badge color="teal">已上线</Badge>
								<Badge color="red" variant="light">
									构建失败
								</Badge>
								<Badge color="yellow" variant="light">
									已归档
								</Badge>
							</Group>
							<Group gap="xs">
								<Button
									size="xs"
									variant="light"
									leftSection={<IconBell size={16} />}
									onClick={() =>
										notifications.show({ color: 'teal', message: '部署完成' })
									}
								>
									成功消息
								</Button>
								<Button
									size="xs"
									variant="light"
									color="red"
									onClick={() =>
										notifications.show({
											color: 'red',
											message: '部署失败，请查看日志',
										})
									}
								>
									失败消息
								</Button>
							</Group>
						</Stack>
					</Section>
				</SimpleGrid>

				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
					{/* Form controls */}
					<Section
						title="表单控件"
						note="TextInput 自带 label / description / error 三个槽位，不用自己拼"
					>
						<Stack gap="md">
							<TextInput
								label="项目名称"
								defaultValue="acme-console"
								placeholder="acme-console"
							/>
							<TextInput label="备注" placeholder="可留空" />
							<Switch
								label="接收构建通知"
								checked={notify}
								onChange={(event) => setNotify(event.currentTarget.checked)}
							/>
						</Stack>
					</Section>

					{/* Selection and progress */}
					<Section
						title="选择与进度"
						note="SegmentedControl / Slider / Progress，给一个 data 数组就行，不用逐个写子组件"
					>
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
									{ value: 'compact', label: '紧凑' },
									{ value: 'comfortable', label: '适中' },
									{ value: 'spacious', label: '宽松' },
								]}
							/>

							<div>
								<Text size="sm" mb="xs">
									音量 {volume}%
								</Text>
								{/*
								 * thumbLabel, not aria-label: the thumb is the element carrying
								 * role="slider", so that's where the accessible name has to
								 * land. Caught by e2e/a11y.e2e.ts otherwise.
								 */}
								<Slider value={volume} onChange={setVolume} thumbLabel="音量" />
							</div>

							<div>
								<Text size="sm" mb="xs">
									构建进度
								</Text>
								{/* Same reasoning: Progress forwards aria-label to its inner
								    section, which is what has role="progressbar". */}
								<Progress value={72} aria-label="构建进度" />
							</div>
						</Stack>
					</Section>
				</SimpleGrid>

				{/* Alerts and tooltips */}
				<Section title="提示与浮层" note="Alert 的语义色，以及 Tooltip">
					<Stack gap="md">
						{ROLES.map((role) => (
							<Alert
								key={role}
								color={role}
								variant="light"
								icon={<IconInfoCircle size={18} />}
								title={`这是一条 ${role} 提示`}
							>
								Alert 的配色来自 color 指定的那组色阶，换主题时不用改这里。
							</Alert>
						))}
						<Group gap="xs">
							<Tooltip
								label="Tooltip 由 floating-ui 驱动，默认只在悬停时出现"
								withArrow
								openDelay={200}
							>
								<Button size="xs" variant="outline">
									悬停看提示
								</Button>
							</Tooltip>
						</Group>
					</Stack>
				</Section>
			</Stack>
		</Container>
	)
}
